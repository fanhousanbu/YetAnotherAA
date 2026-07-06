/**
 * DVT node-operator registration — SDK boundary (aastar-sdk#279 / PR #288).
 *
 * DVT signing nodes register on the AAStarValidator via `registerWithProof`
 * (YetAnotherAA-Validator #165): stake gate (ROLE_DVT + GToken ≥ minStake) + a
 * BLS proof-of-possession (`e(pk, popPoint) == e(G1, popSig)`) + one-operator-one-node,
 * with `nodeId = keccak256(pubkey)`. Registration is signed in the operator's own
 * browser wallet (viem WalletClient from WalletContext) — never the backend key,
 * and the BLS **secret key never leaves the browser**.
 *
 * The typed action surface below is the contract published by @repo:sdk:
 *
 *   import { buildDvtPop, dvtOperatorActions } from "@aastar/sdk/core";
 *   const pop = buildDvtPop(blsSecretKey);            // { publicKey, popPoint, popSig, nodeId }
 *   const dvt = walletClient.extend(dvtOperatorActions(validatorAddr));
 *   await dvt.requireStake(); await dvt.minStake();
 *   const bound = await dvt.operatorNode({ operator });
 *   const { hash, pop } = await dvt.register({ blsSecretKey });
 *
 * Those exports ship in @aastar/sdk 0.37.4 / 0.38.0 (branch feat/dvt-register-api-279);
 * the installed workspace is 0.35.0, so importing them now would break type-check.
 * Until it publishes, `DVT_SDK_READY` is false and the chain-touching calls throw
 * {@link DvtSdkPendingError} — the wizard renders a clear "waiting for SDK" state
 * rather than failing to build. Wiring is a one-file change: flip `DVT_SDK_READY`,
 * add the import, and replace each `WIRE-HERE` stub body. The local, SDK-independent
 * bits (BLS key generation + hex validation) already work.
 *
 * @module lib/sdk/dvtOperator
 */
import type { WalletClient } from "viem";

/** Flip to true once @aastar/sdk 0.37.4/0.38.0 (PR #288) is installed and wired below. */
export const DVT_SDK_READY = false;

export type Hex = `0x${string}`;

/** Proof-of-possession tuple produced locally from a BLS secret key. */
export interface DvtPop {
  /** EIP-2537 128-byte G1 public key (hex). */
  publicKey: Hex;
  /** G2 message point the PoP signs over (hex). */
  popPoint: Hex;
  /** BLS signature `sk · popPoint` (hex). */
  popSig: Hex;
  /** `keccak256(publicKey)` — the on-chain node id. */
  nodeId: Hex;
}

/** Operator's on-chain eligibility snapshot for DVT registration. */
export interface DvtEligibility {
  /** Node id already bound to this operator, or null if unregistered. */
  boundNodeId: Hex | null;
  /** Whether stake-gated registration is currently open (`requireStake`). */
  stakeOpen: boolean;
  /** ROLE_DVT stake threshold in wei (`minStake`). */
  minStake: bigint;
}

/** Result of a one-shot `register({ blsSecretKey })`. */
export interface DvtRegisterResult {
  hash: Hex;
  pop: DvtPop;
}

/** Thrown by chain/crypto calls while the SDK is not yet published (PR #288). */
export class DvtSdkPendingError extends Error {
  constructor() {
    super(
      "DVT SDK not yet available (pending @aastar/sdk 0.37.4/0.38.0, aastar-sdk#279 / PR #288)."
    );
    this.name = "DvtSdkPendingError";
  }
}

// ── Local helpers (SDK-independent, already functional) ──────────────────────

/** True if `input` is a 0x-prefixed 32-byte (64 hex char) scalar. */
export function isBlsSecretKeyHex(input: string): input is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(input.trim());
}

/**
 * Normalise a pasted BLS secret key to canonical lowercase `0x…64` hex.
 * @throws if the input is not a 32-byte hex scalar.
 */
export function normalizeBlsSecretKey(input: string): Hex {
  const v = input.trim();
  if (!isBlsSecretKeyHex(v)) {
    throw new Error("Invalid BLS secret key: expected a 0x-prefixed 32-byte hex string.");
  }
  return v.toLowerCase() as Hex;
}

/**
 * Generate a random 32-byte BLS secret key in the browser (never leaves the tab).
 * A uniformly random 256-bit value is < the BLS12-381 scalar order with
 * overwhelming probability; if the SDK later exposes a canonical generator that
 * reduces mod r, prefer it at the WIRE-HERE site.
 */
export function generateBlsSecretKey(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
  return `0x${hex}` as Hex;
}

// ── SDK-backed surface (WIRE-HERE when PR #288 publishes) ────────────────────

/**
 * Derive the proof-of-possession + nodeId from a BLS secret key. Pure/local in
 * the SDK too (no network), so once wired this works offline.
 */
export function buildDvtPop(_blsSecretKey: Hex): DvtPop {
  // WIRE-HERE: return buildDvtPop(_blsSecretKey) from "@aastar/sdk/core".
  throw new DvtSdkPendingError();
}

/** Read the operator's registration + stake eligibility. */
export async function fetchDvtEligibility(
  _walletClient: WalletClient,
  _operator: Hex
): Promise<DvtEligibility> {
  // WIRE-HERE:
  //   const dvt = _walletClient.extend(dvtOperatorActions(DVT_VALIDATOR_ADDRESS));
  //   const [boundNodeId, stakeOpen, minStake] = await Promise.all([
  //     dvt.operatorNode({ operator: _operator }),
  //     dvt.requireStake(),
  //     dvt.minStake(),
  //   ]);
  //   return { boundNodeId: isZero(boundNodeId) ? null : boundNodeId, stakeOpen, minStake };
  throw new DvtSdkPendingError();
}

/** One-shot: build PoP from the secret key and submit `register`. */
export async function registerDvtNode(
  _walletClient: WalletClient,
  _blsSecretKey: Hex
): Promise<DvtRegisterResult> {
  // WIRE-HERE:
  //   const dvt = _walletClient.extend(dvtOperatorActions(DVT_VALIDATOR_ADDRESS));
  //   return dvt.register({ blsSecretKey: _blsSecretKey });
  throw new DvtSdkPendingError();
}

/**
 * HSM path: submit a PoP produced outside the browser via `registerWithProof`.
 */
export async function registerDvtNodeWithProof(
  _walletClient: WalletClient,
  _pop: Pick<DvtPop, "publicKey" | "popPoint" | "popSig">
): Promise<Hex> {
  // WIRE-HERE:
  //   const dvt = _walletClient.extend(dvtOperatorActions(DVT_VALIDATOR_ADDRESS));
  //   return dvt.registerWithProof(_pop);
  throw new DvtSdkPendingError();
}

/** Confirm a node id is registered on-chain (post-tx read-back). */
export async function isDvtNodeRegistered(
  _walletClient: WalletClient,
  _nodeId: Hex
): Promise<boolean> {
  // WIRE-HERE:
  //   const dvt = _walletClient.extend(dvtOperatorActions(DVT_VALIDATOR_ADDRESS));
  //   return dvt.isRegistered(_nodeId);
  throw new DvtSdkPendingError();
}
