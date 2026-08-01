import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { InternalServerErrorException } from "@nestjs/common";
import { AccountService } from "./account.service";
import { DatabaseService } from "../database/database.service";
import { YAAA_SERVER_CLIENT } from "../sdk/sdk.providers";

// `uuid` ships ESM-only and this project's jest transform doesn't cover node_modules;
// nothing under test generates an id, so a stub is enough.
jest.mock("uuid", () => ({ v4: () => "00000000-0000-4000-8000-000000000000" }));

const mockGetChainId = jest.fn();
const capturedWalletConfigs: any[] = [];

// Real viem elsewhere (resolveChain/defineChain/parseEther are all used for real);
// only the client factories are swapped so nothing hits the network and we can see
// exactly which `chain` the deployer wallet was built with.
jest.mock("viem", () => {
  const actual = jest.requireActual("viem");
  return {
    ...actual,
    createPublicClient: jest.fn(() => ({ getChainId: mockGetChainId })),
    createWalletClient: jest.fn((cfg: any) => {
      capturedWalletConfigs.push(cfg);
      return { ...cfg };
    }),
  };
});

const DEPLOYER_KEY = `0x${"a".repeat(64)}`;
const OWNER = "0x1111111111111111111111111111111111111111";
const FACTORY = "0x9999999999999999999999999999999999999999";

describe("AccountService — chain consistency (issue #439)", () => {
  let service: AccountService;
  const mockConfigGet = jest.fn();
  const mockEnsureSigner = jest.fn();
  const mockBuildGuardianAcceptanceHash = jest.fn();
  const mockSubmitPreparedCreateAccount = jest.fn();

  const buildService = async (chainId: unknown) => {
    mockConfigGet.mockImplementation((key: string) => {
      const cfg: Record<string, unknown> = {
        ethRpcUrl: "http://localhost:8545",
        deployerPrivateKey: DEPLOYER_KEY,
        chainId,
      };
      return cfg[key];
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountService,
        { provide: ConfigService, useValue: { get: mockConfigGet } },
        { provide: DatabaseService, useValue: { findUserById: jest.fn() } },
        {
          provide: YAAA_SERVER_CLIENT,
          useValue: {
            wallets: { ensureSigner: mockEnsureSigner },
            ethereum: { getFactoryAddress: () => FACTORY },
            accounts: {
              buildGuardianAcceptanceHash: mockBuildGuardianAcceptanceHash,
              submitPreparedCreateAccount: mockSubmitPreparedCreateAccount,
            },
          },
        },
      ],
    }).compile();

    return module.get<AccountService>(AccountService);
  };

  beforeEach(() => {
    capturedWalletConfigs.length = 0;
    for (const m of [
      mockGetChainId,
      mockEnsureSigner,
      mockBuildGuardianAcceptanceHash,
      mockSubmitPreparedCreateAccount,
    ]) {
      m.mockReset();
    }
    mockEnsureSigner.mockResolvedValue({ address: OWNER });
    mockBuildGuardianAcceptanceHash.mockReturnValue("0xacceptance");
    mockSubmitPreparedCreateAccount.mockResolvedValue({ address: OWNER, deployed: true });
  });

  // The defect: the deployer wallet hardcoded `sepolia` while the guardian acceptance
  // hash and the CREATE_ACCOUNT digest are bound to the configured chainId. On any
  // non-Sepolia config the user signs for one chain and the account is deployed on
  // another. Same shape as PR #434 fixed in GuardianService.
  describe.each([11155111, 10, 8453])("chainId=%i", chainId => {
    beforeEach(async () => {
      mockGetChainId.mockResolvedValue(chainId);
      service = await buildService(chainId);
    });

    it("binds the guardian acceptance hash to the configured chain", async () => {
      const prepared = await service.prepareGuardianSetup("user-1", {} as any);

      expect(prepared.chainId).toBe(chainId);
      // 4th positional arg of buildGuardianAcceptanceHash(owner, salt, factory, chainId, limit)
      expect(mockBuildGuardianAcceptanceHash.mock.calls[0][3]).toBe(chainId);
      expect(JSON.parse(prepared.qrPayload).chainId).toBe(chainId);
    });

    it("relays the deploy on that same chain", async () => {
      await service.submitCreateWithPasskey("user-1", {
        createId: "c-1",
        challengeId: "ch-1",
        credential: {},
      } as any);

      expect(capturedWalletConfigs).toHaveLength(1);
      expect(capturedWalletConfigs[0].chain.id).toBe(chainId);
    });
  });

  // viem does not check this for us: `assertCurrentChain` runs only for json-rpc
  // accounts, and the deployer is a local (private-key) account, whose
  // prepareTransactionRequest takes `chain.id` on faith without issuing eth_chainId.
  describe("RPC/config chain mismatch", () => {
    beforeEach(async () => {
      mockGetChainId.mockResolvedValue(11155111); // RPC is on Sepolia…
      service = await buildService(10); // …but CHAIN_ID says OP mainnet.
    });

    it("refuses to build an acceptance hash the guardian would sign for the wrong chain", async () => {
      await expect(service.prepareGuardianSetup("user-1", {} as any)).rejects.toThrow(
        /Chain mismatch/
      );
      expect(mockBuildGuardianAcceptanceHash).not.toHaveBeenCalled();
    });

    it("refuses to relay the deploy, before spending the one-time WebAuthn ceremony", async () => {
      await expect(
        service.submitCreateWithPasskey("user-1", {
          createId: "c-1",
          challengeId: "ch-1",
          credential: {},
        } as any)
      ).rejects.toThrow(/Chain mismatch/);
      expect(mockSubmitPreparedCreateAccount).not.toHaveBeenCalled();
      expect(capturedWalletConfigs).toHaveLength(0);
    });
  });

  it("refuses an unusable chainId instead of falling back to a hardcoded default", async () => {
    for (const bad of [undefined, 0, -1]) {
      mockGetChainId.mockResolvedValue(11155111);
      service = await buildService(bad);
      await expect(service.prepareGuardianSetup("user-1", {} as any)).rejects.toThrow(
        InternalServerErrorException
      );
      expect(mockBuildGuardianAcceptanceHash).not.toHaveBeenCalled();
    }
  });
});
