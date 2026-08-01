/**
 * Community KMS+DVT node onboarding — SDK boundary (CC-40).
 *
 * Ported from the aastar-sdk `node-onboarding-portal` (PR #309/#310, headless
 * Playwright + on-chain E2E verified). This is the ONLY module that touches
 * chain / keys / crypto: every underlying operation goes through `@aastar/sdk`,
 * so the page (`app/operator/node-onboarding`) is pure flow-wiring. The single
 * seam adapted for YAAA is the wallet connection — it now sources the injected
 * provider via YAAA's `lib/sdk/client` (`getInjectedProvider`) instead of the
 * portal's own `window.ethereum` glue; the SDK calls are otherwise unchanged.
 *
 * NARROW subpaths (`@aastar/sdk/operator` + `/core`) are imported deliberately —
 * the umbrella `@aastar/sdk` barrel pulls node-only code (fs config I/O) that
 * breaks a browser bundle. Needs `@aastar/sdk` ^0.43.0 (0.42.0's /operator had a
 * child_process → browser-bundle regression, fixed in 0.43.0).
 *
 * @module lib/sdk/nodeOnboarding
 */
import { type Address, type Hex, createPublicClient, createWalletClient, custom, http } from "viem";
import { sepolia, optimismSepolia } from "viem/chains";
import {
  onboardDvtNode,
  kmsPopSigner as sdkKmsPopSigner,
  type OnboardDvtNodeResult,
  type KmsPopSignerOptions,
} from "@aastar/sdk/operator";
import { buildDvtPop, type DvtPop } from "@aastar/sdk/core";
import { getInjectedProvider } from "./client";
import { generateBlsSecretKey } from "./dvtOperator";

/** Which class of node is being onboarded — the flow forks on where the BLS key lives. */
export type NodeKind = "local" | "kms-tee";

export type StepStatus = "pending" | "active" | "doing" | "done" | "error";

export interface PortalConfig {
  network: "sepolia" | "op-sepolia";
  nodeKind: NodeKind;
  /** KMS base URL (only for kms-tee nodes), e.g. http://127.0.0.1:3100. */
  kmsUrl: string;
  /** Optional DVT service base URL for /recipe and /identity reads. */
  dvtUrl: string;
}

/** The PoP tuple, mirroring @aastar/sdk DvtPop. */
export interface Pop {
  publicKey: Hex;
  popPoint: Hex;
  popSig: Hex;
  nodeId: Hex;
}

export interface WalletConn {
  address: Address;
  chainId: number;
}

const CHAINS = { sepolia, "op-sepolia": optimismSepolia } as const;

type Eip1193 = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> };

/** The injected wallet, via YAAA's provider accessor. Throws if none is present. */
function injected(): Eip1193 {
  const eth = getInjectedProvider() as Eip1193 | undefined;
  if (!eth) throw new Error("No injected wallet found (install MetaMask or a compatible wallet).");
  return eth;
}

/** Connect the injected wallet and return the operator address + chainId. */
export async function connectWallet(): Promise<WalletConn> {
  const eth = injected();
  const accounts = (await eth.request({ method: "eth_requestAccounts" })) as Address[];
  if (!accounts?.length) throw new Error("Wallet returned no accounts.");
  const chainIdHex = (await eth.request({ method: "eth_chainId" })) as string;
  return { address: accounts[0], chainId: Number(BigInt(chainIdHex)) };
}

/** Public (read) client for a network. */
export function publicClientFor(cfg: PortalConfig) {
  return createPublicClient({ chain: CHAINS[cfg.network], transport: http() });
}

/** Wallet (write) client bound to the connected operator account via the injected provider. */
export function operatorWalletFor(cfg: PortalConfig, operator: Address) {
  return createWalletClient({
    account: operator,
    chain: CHAINS[cfg.network],
    transport: custom(injected()),
  });
}

/**
 * Fresh in-browser BLS secret key for a LOCAL node (never leaves the browser;
 * the user saves it). Rejection-sampled into the valid scalar range [1, r-1] —
 * delegates to the shared, Codex-reviewed generator (unbiased, unlike a plain
 * `mod r` which skews the distribution and overweights 1).
 */
export function generateLocalBlsKey(): Hex {
  return generateBlsSecretKey();
}

/** Derive the PoP tuple locally from a BLS secret key — SDK core, pure crypto, no chain. */
export function popFromLocalKey(blsSecretKey: Hex): Pop {
  return buildDvtPop(blsSecretKey) as DvtPop;
}

/**
 * CC-37 KMS `/pop` is not live yet (rework + A-board TA reflash), so key-less
 * KMS-TEE node registration is gated OFF. Flip to `true` when the endpoint ships;
 * the local/HSM key path is unaffected.
 */
export const KMS_TEE_READY = false;

/**
 * Build the SDK's KMS-TEE `/pop` PoP signer for `onboardDvtNode`. The SDK signer
 * pins the expected public key, recomputes `popPoint` + runs the PoP pairing
 * on-response (bad tuple fails before stake), and derives `nodeId` locally — the
 * security-hardened path we must go through rather than a raw `/pop` fetch.
 * A full EIP-2537 public key is PINNED (rejects KMS/MITM key substitution); a
 * bare node id addresses a KMS the operator controls (board loopback) and so
 * opts into the unpinned mapping.
 */
function buildKmsPopSigner(cfg: PortalConfig, ref: string): () => Promise<DvtPop> {
  const v = ref.trim();
  const looksLikePubkey = v.startsWith("0x") && v.length > 66;
  const opts: KmsPopSignerOptions = looksLikePubkey
    ? { url: cfg.kmsUrl, publicKey: v as Hex }
    : { url: cfg.kmsUrl, nodeId: v, allowUnpinnedKmsKey: true };
  return sdkKmsPopSigner(opts);
}

export interface OnboardArgs {
  cfg: PortalConfig;
  operator: Address;
  /** local-key path: the generated/entered BLS secret key. */
  blsSecretKey?: Hex;
  /** kms-tee path: node id/pubkey the KMS maps to its sealed TEE key. */
  kmsNodeRef?: string;
  dryRun: boolean;
}

/**
 * The single entrypoint the UI calls to stake + register — a thin wrapper over @aastar/sdk `onboardDvtNode`.
 * Operator self-funds (the connected wallet is the operator); "owner 代付" needs an owner key that a browser
 * must not hold, so it is a backend/advanced concern deliberately left out of this client-only flow.
 */
export async function onboard(args: OnboardArgs): Promise<OnboardDvtNodeResult> {
  const { cfg, operator, blsSecretKey, kmsNodeRef, dryRun } = args;
  // The SDK bundles its own viem type tree; YAAA pins its own viem. The clients are runtime-compatible
  // but their bundled .d.ts shapes skew (e.g. getBlock's transactions union), so widen at this one seam.
  const publicClient = publicClientFor(cfg) as unknown as never;
  const operatorWallet = operatorWalletFor(cfg, operator) as unknown as never;
  const base = { publicClient, operatorWallet, dryRun };

  if (cfg.nodeKind === "kms-tee") {
    if (!KMS_TEE_READY) {
      throw new Error(
        "KMS-TEE key-less 节点注册尚未开放：依赖 KMS /pop 上线（CC-37 返工 + A 板 TA 重刷）。请改用本地/HSM 私钥节点。"
      );
    }
    if (!kmsNodeRef) throw new Error("kms-tee node requires a KMS node id / pubkey reference");
    return onboardDvtNode({ ...base, popSigner: buildKmsPopSigner(cfg, kmsNodeRef) });
  }
  if (!blsSecretKey) throw new Error("local node requires a BLS secret key");
  return onboardDvtNode({ ...base, blsSecretKey });
}

/** DVT service reads — config recipe + runtime identity. Best-effort; the flow works without them. */
export async function fetchRecipe(cfg: PortalConfig): Promise<unknown | null> {
  if (!cfg.dvtUrl) return null;
  try {
    const r = await fetch(`${cfg.dvtUrl.replace(/\/$/, "")}/recipe?network=${cfg.network}`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function fetchIdentity(cfg: PortalConfig, nodeId: Hex): Promise<unknown | null> {
  if (!cfg.dvtUrl) return null;
  try {
    const r = await fetch(`${cfg.dvtUrl.replace(/\/$/, "")}/identity/${nodeId}`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export type { OnboardDvtNodeResult, DvtPop };
