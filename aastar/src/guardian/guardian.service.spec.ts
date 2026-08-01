import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { InternalServerErrorException } from "@nestjs/common";
import { GuardianService } from "./guardian.service";
import { DatabaseService } from "../database/database.service";

// `uuid` ships ESM-only and this project's jest transform doesn't cover node_modules;
// the recovery paths under test never generate an id, so a stub is enough.
jest.mock("uuid", () => ({ v4: () => "00000000-0000-4000-8000-000000000000" }));

const mockReadContract = jest.fn();
const capturedWalletConfigs: any[] = [];

// Keep the real viem (parseAbi/defineChain/encoding are all used for real); only the
// two client factories are swapped so no network call happens and we can inspect
// exactly which `chain` the relay wallet was built with.
jest.mock("viem", () => {
  const actual = jest.requireActual("viem");
  return {
    ...actual,
    createPublicClient: jest.fn(() => ({ readContract: mockReadContract })),
    createWalletClient: jest.fn((cfg: any) => {
      capturedWalletConfigs.push(cfg);
      return { ...cfg, writeContract: jest.fn() };
    }),
  };
});

const ZERO32 = "0x" + "00".repeat(32);
const NON_ZERO32 = "0x" + "11".repeat(32);
const FUNDED_KEY = `0x${"a".repeat(64)}`;

describe("GuardianService — recovery chain consistency (PR #434)", () => {
  let service: GuardianService;
  const mockConfigGet = jest.fn();

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
        { provide: DatabaseService, useValue: {} },
      ],
    }).compile();

    return module.get<GuardianService>(GuardianService);
  };

  beforeEach(() => {
    capturedWalletConfigs.length = 0;
    mockReadContract.mockReset();
    // Guardian slot 0 is a P-256 guardian, slots 1/2 are empty; recovery nonce = 7n.
    mockReadContract.mockImplementation(({ functionName, args }: any) => {
      if (functionName === "getGuardianP256Key") {
        return args[0] === 0n ? [NON_ZERO32, NON_ZERO32] : [ZERO32, ZERO32];
      }
      if (functionName === "getRecoveryNonce") return 7n;
      throw new Error(`unexpected readContract: ${functionName}`);
    });
  });

  // The regression this guards: before the fix the relay wallet hardcoded `sepolia`
  // while the P-256 challenge was domain-separated on the configured chainId, so on
  // any non-Sepolia config the guardian signed for one chain and the transaction was
  // broadcast to another — the on-chain signature check would fail at recovery time.
  it.each([11155111, 10, 8453])(
    "broadcasts to the same chain the P-256 challenge is signed for (chainId=%i)",
    async chainId => {
      service = await buildService(chainId);

      const prepared = await service.prepareP256Recovery({
        accountAddress: "0x1111111111111111111111111111111111111111",
        newOwner: "0x2222222222222222222222222222222222222222",
      } as any);

      // Exercise the relay path the signed challenge is ultimately submitted through.
      const walletClient = (service as any).getRelayWalletClient();

      expect(prepared.chainId).toBe(chainId);
      expect(walletClient.chain.id).toBe(chainId);
      expect(prepared.chainId).toBe(walletClient.chain.id);
    }
  );

  it("refuses to build a relay wallet when chainId is unusable", async () => {
    for (const bad of [undefined, 0, -1]) {
      service = await buildService(bad);
      expect(() => (service as any).getRelayWalletClient()).toThrow(InternalServerErrorException);
      expect(capturedWalletConfigs).toHaveLength(0);
    }
  });
});
