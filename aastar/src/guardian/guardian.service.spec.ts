import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { InternalServerErrorException } from "@nestjs/common";
import { GuardianService } from "./guardian.service";
import { DatabaseService } from "../database/database.service";

// `uuid` ships ESM-only and this project's jest transform doesn't cover node_modules;
// the recovery paths under test never generate an id, so a stub is enough.
jest.mock("uuid", () => ({ v4: () => "00000000-0000-4000-8000-000000000000" }));

// Building a real WebAuthn assertion blob is out of scope here — the invariant under
// test is which chain the relay broadcasts to, not assertion encoding.
jest.mock("@aastar/sdk", () => {
  const actual = jest.requireActual("@aastar/sdk");
  return { ...actual, encodeWebAuthnAssertion: jest.fn(() => "0xdeadbeef") };
});

const mockReadContract = jest.fn();
const mockGetChainId = jest.fn();
const mockWaitForTransactionReceipt = jest.fn();
const mockWriteContract = jest.fn();
const capturedWalletConfigs: any[] = [];

// Keep the real viem (parseAbi/defineChain/encoding are all used for real); only the
// two client factories are swapped so no network call happens and we can inspect
// exactly which `chain` the relay wallet and each write were built with.
jest.mock("viem", () => {
  const actual = jest.requireActual("viem");
  return {
    ...actual,
    createPublicClient: jest.fn(() => ({
      readContract: mockReadContract,
      getChainId: mockGetChainId,
      waitForTransactionReceipt: mockWaitForTransactionReceipt,
    })),
    createWalletClient: jest.fn((cfg: any) => {
      capturedWalletConfigs.push(cfg);
      return { ...cfg, writeContract: mockWriteContract };
    }),
  };
});

const ZERO32 = "0x" + "00".repeat(32);
const NON_ZERO32 = "0x" + "11".repeat(32);
const FUNDED_KEY = `0x${"a".repeat(64)}`;
const ACCOUNT = "0x1111111111111111111111111111111111111111";
const NEW_OWNER = "0x2222222222222222222222222222222222222222";

describe("GuardianService — recovery chain consistency (PR #434)", () => {
  let service: GuardianService;
  const mockConfigGet = jest.fn();
  const mockFindPendingRecovery = jest.fn();
  const mockUpdateRecoveryRequest = jest.fn();
  const mockUpdateAccountByAddress = jest.fn();

  const buildService = async (chainId: unknown) => {
    mockConfigGet.mockImplementation((key: string) => {
      const cfg: Record<string, unknown> = {
        ethRpcUrl: "http://localhost:8545",
        ethPrivateKey: FUNDED_KEY,
        chainId,
      };
      return cfg[key];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuardianService,
        { provide: ConfigService, useValue: { get: mockConfigGet } },
        {
          provide: DatabaseService,
          useValue: {
            findPendingRecovery: mockFindPendingRecovery,
            updateRecoveryRequest: mockUpdateRecoveryRequest,
            updateAccountByAddress: mockUpdateAccountByAddress,
          },
        },
      ],
    }).compile();

    return module.get<GuardianService>(GuardianService);
  };

  beforeEach(() => {
    capturedWalletConfigs.length = 0;
    for (const m of [
      mockReadContract,
      mockGetChainId,
      mockWaitForTransactionReceipt,
      mockWriteContract,
      mockFindPendingRecovery,
      mockUpdateRecoveryRequest,
      mockUpdateAccountByAddress,
    ]) {
      m.mockReset();
    }

    // Guardian slot 0 is a P-256 guardian, slots 1/2 are empty; recovery nonce = 7n.
    mockReadContract.mockImplementation(({ functionName, args }: any) => {
      if (functionName === "getGuardianP256Key") {
        return args[0] === 0n ? [NON_ZERO32, NON_ZERO32] : [ZERO32, ZERO32];
      }
      if (functionName === "getRecoveryNonce") return 7n;
      // Default: the on-chain proposal agrees with the tracked request.
      if (functionName === "activeRecovery") return [NEW_OWNER, 0n, 0n, 0n];
      throw new Error(`unexpected readContract: ${functionName}`);
    });
    mockWriteContract.mockResolvedValue("0xtxhash");
    mockWaitForTransactionReceipt.mockResolvedValue({ status: "success", blockNumber: 1n });
    // A quorum-met, timelock-expired pending request so executeRecovery reaches the write.
    mockFindPendingRecovery.mockResolvedValue({
      id: "req-1",
      newSignerAddress: NEW_OWNER,
      supporters: ["0xaaa", "0xbbb"],
      executeAfter: Date.now() - 1000,
    });
  });

  // The regression this guards: before the fix the relay wallet and both writeContract
  // sites hardcoded `sepolia` while the P-256 challenge was domain-separated on the
  // configured chainId, so on any non-Sepolia config the guardian signed for one chain
  // and the transaction targeted another — the on-chain signature check would fail.
  describe.each([11155111, 10, 8453])("chainId=%i", chainId => {
    beforeEach(async () => {
      mockGetChainId.mockResolvedValue(chainId);
      service = await buildService(chainId);
    });

    it("domain-separates the P-256 challenge with the configured chain", async () => {
      const prepared = await service.prepareP256Recovery({
        accountAddress: ACCOUNT,
        newOwner: NEW_OWNER,
      } as any);

      expect(prepared.chainId).toBe(chainId);
      expect((service as any).getRelayWalletClient().chain.id).toBe(chainId);
    });

    it("broadcasts submitP256Recovery to that same chain", async () => {
      await service.submitP256Recovery({
        accountAddress: ACCOUNT,
        newOwner: NEW_OWNER,
        authenticatorData: "0x00",
        clientDataJSON: "0x00",
        r: "0x00",
        s: "0x00",
      } as any);

      expect(mockWriteContract).toHaveBeenCalledTimes(1);
      expect(mockWriteContract.mock.calls[0][0].functionName).toBe("proposeRecoveryWithSig");
      expect(mockWriteContract.mock.calls[0][0].chain.id).toBe(chainId);
    });

    it("broadcasts executeRecovery to that same chain", async () => {
      await service.executeRecovery(ACCOUNT);

      expect(mockWriteContract).toHaveBeenCalledTimes(1);
      expect(mockWriteContract.mock.calls[0][0].functionName).toBe("executeRecovery");
      expect(mockWriteContract.mock.calls[0][0].chain.id).toBe(chainId);
    });
  });

  // viem gives us no protection here: `assertCurrentChain` runs only for json-rpc
  // accounts, and for a local account `prepareTransactionRequest` short-circuits on
  // `chain.id` without ever calling eth_chainId. So the preflight must be ours.
  describe("RPC/config chain mismatch", () => {
    beforeEach(async () => {
      mockGetChainId.mockResolvedValue(11155111); // RPC is on Sepolia…
      service = await buildService(10); // …but CHAIN_ID says OP mainnet.
    });

    it("refuses to hand out a challenge the guardian could never use", async () => {
      await expect(
        service.prepareP256Recovery({ accountAddress: ACCOUNT, newOwner: NEW_OWNER } as any)
      ).rejects.toThrow(/Chain mismatch/);
    });

    it("refuses to broadcast submitP256Recovery", async () => {
      await expect(
        service.submitP256Recovery({
          accountAddress: ACCOUNT,
          newOwner: NEW_OWNER,
          authenticatorData: "0x00",
          clientDataJSON: "0x00",
          r: "0x00",
          s: "0x00",
        } as any)
      ).rejects.toThrow(/Chain mismatch/);
      expect(mockWriteContract).not.toHaveBeenCalled();
    });

    it("refuses to broadcast executeRecovery", async () => {
      await expect(service.executeRecovery(ACCOUNT)).rejects.toThrow(/Chain mismatch/);
      expect(mockWriteContract).not.toHaveBeenCalled();
      // The request must stay pending so it can be retried after the config is fixed.
      expect(mockUpdateRecoveryRequest).not.toHaveBeenCalled();
    });
  });

  // executeRecovery() is argument-less — the contract acts on whatever proposal is
  // active on-chain, which the passkey path or a direct proposeRecovery() call can
  // overwrite. Executing blind would rotate the owner to an address this backend
  // never vetted and then record the *tracked* one, desyncing the DB from the chain.
  describe("on-chain proposal vs tracked request (issue #438)", () => {
    const OTHER_OWNER = "0x3333333333333333333333333333333333333333";

    beforeEach(async () => {
      mockGetChainId.mockResolvedValue(11155111);
      service = await buildService(11155111);
    });

    const expectNothingHappened = () => {
      expect(mockWriteContract).not.toHaveBeenCalled();
      expect(mockUpdateRecoveryRequest).not.toHaveBeenCalled();
      expect(mockUpdateAccountByAddress).not.toHaveBeenCalled();
    };

    it("refuses when the on-chain proposal targets a different owner", async () => {
      mockReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === "activeRecovery") return [OTHER_OWNER, 0n, 0n, 0n];
        throw new Error(`unexpected readContract: ${functionName}`);
      });

      await expect(service.executeRecovery(ACCOUNT)).rejects.toThrow(
        new RegExp(`${OTHER_OWNER}.*${NEW_OWNER}`)
      );
      expectNothingHappened();
    });

    it("refuses when no proposal is active on-chain", async () => {
      mockReadContract.mockImplementation(({ functionName }: any) => {
        // newOwner === address(0) is the contract's "nothing proposed" encoding.
        if (functionName === "activeRecovery")
          return ["0x0000000000000000000000000000000000000000", 0n, 0n, 0n];
        throw new Error(`unexpected readContract: ${functionName}`);
      });

      await expect(service.executeRecovery(ACCOUNT)).rejects.toThrow(/No active recovery proposal/);
      expectNothingHappened();
    });

    it("surfaces a failed read instead of treating it as 'nothing proposed'", async () => {
      mockReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === "activeRecovery") throw new Error("RPC exploded");
        throw new Error(`unexpected readContract: ${functionName}`);
      });

      await expect(service.executeRecovery(ACCOUNT)).rejects.toThrow(/RPC exploded/);
      expectNothingHappened();
    });

    it("proceeds and records the on-chain owner when the two agree", async () => {
      // Same address, different casing — the comparison must not care, and the value
      // written to the DB must be the chain's, not the request's.
      const CHECKSUMMED = NEW_OWNER.toUpperCase().replace("0X", "0x");
      mockReadContract.mockImplementation(({ functionName }: any) => {
        if (functionName === "activeRecovery") return [CHECKSUMMED, 0n, 0n, 0n];
        throw new Error(`unexpected readContract: ${functionName}`);
      });

      const result = await service.executeRecovery(ACCOUNT);

      expect(mockWriteContract).toHaveBeenCalledTimes(1);
      expect(mockUpdateAccountByAddress).toHaveBeenCalledWith(ACCOUNT, {
        signerAddress: CHECKSUMMED,
      });
      expect(result.newSignerAddress).toBe(CHECKSUMMED);
    });
  });

  it("refuses to build a relay wallet when chainId is unusable", async () => {
    for (const bad of [undefined, 0, -1]) {
      service = await buildService(bad);
      expect(() => (service as any).getRelayWalletClient()).toThrow(InternalServerErrorException);
      expect(capturedWalletConfigs).toHaveLength(0);
    }
  });
});
