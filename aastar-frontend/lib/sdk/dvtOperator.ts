/**
 * DVT node-operator registration — SDK boundary (aastar-sdk#279).
 *
 * DVT signing nodes register on the AAStarValidator via `registerWithProof`
 * (YetAnotherAA-Validator #165): stake gate (ROLE_DVT + GToken ≥ minStake) + a
 * BLS proof-of-possession (`e(pk, popPoint) == e(G1, popSig)`) + one-operator-one-node,
 * with `nodeId = keccak256(pubkey)`. Registration is signed in the operator's own
 * browser wallet (viem WalletClient from WalletContext) — never the backend key,
 * and the BLS **secret key never leaves the browser**.
 *
 * Backed by @aastar/sdk 0.38.0 `@aastar/sdk/core` (aastar-sdk#288, E2E LIVE PASS
 * on Sepolia, tx 0x216a7ed5…): `buildDvtPop` derives the PoP + nodeId locally
 * (no network); `dvtOperatorActions(validator)(client)` decorates a viem client
 * with the typed registry actions. The validator address comes from the SDK's
 * canonical `DVT_VALIDATOR_ADDRESS` (set by `applyConfig` via `ensureSdkConfig`),
 * never hardcoded here.
 *
 * @module lib/sdk/dvtOperator
 */
import type { WalletClient } from "viem";
import {
  buildDvtPop as sdkBuildDvtPop,
  dvtOperatorActions,
  DVT_VALIDATOR_ADDRESS,
} from "@aastar/sdk/core";
import { ensureSdkConfig, getPublicClient } from "./client";

/** DVT SDK actions are wired (kept for the wizard's step gating). */
export const DVT_SDK_READY = true;

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

/** A bytes32 that is all zeros — the registry's "unset" sentinel for node ids. */
function isZeroHash(value: string): boolean {
  return /^0x0*$/i.test(value);
}

// ── Local helpers (SDK-independent) ──────────────────────────────────────────

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
 * BLS12-381 scalar field order r. A random 256-bit value is ≥ r ~55% of the time
 * (r ≈ 0.453·2²⁵⁶), so a single draw is NOT reliably a valid secret key.
 */
const BLS12_381_R = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001n;

/**
 * Generate a random BLS secret key in the browser (never leaves the tab).
 * Rejection-samples until the 256-bit draw lands in [1, r-1] — the valid scalar
 * range `buildDvtPop` requires — so the result never trips its range check.
 * Success probability per draw is ~45%, so this loops ~2 times on average.
 */
export function generateBlsSecretKey(): Hex {
  for (;;) {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    const value = BigInt(`0x${hex}`);
    if (value >= 1n && value < BLS12_381_R) return `0x${hex}` as Hex;
  }
}

// ── SDK-backed surface (@aastar/sdk 0.38.0) ──────────────────────────────────

/** DVT registry actions bound to a read-only public client. */
function readActions() {
  ensureSdkConfig();
  return dvtOperatorActions(DVT_VALIDATOR_ADDRESS)(getPublicClient());
}

/** DVT registry actions bound to the operator's signing wallet client. */
function writeActions(walletClient: WalletClient) {
  ensureSdkConfig();
  return dvtOperatorActions(DVT_VALIDATOR_ADDRESS)(walletClient);
}

/**
 * Derive the proof-of-possession + nodeId from a BLS secret key. Pure/local
 * (no network), so this works offline once the operator has a key.
 * @throws if the secret key is out of range (0 or ≥ curve order).
 */
export function buildDvtPop(blsSecretKey: Hex): DvtPop {
  return sdkBuildDvtPop(blsSecretKey);
}

/** Read the operator's registration + stake eligibility. */
export async function fetchDvtEligibility(
  _walletClient: WalletClient,
  operator: Hex
): Promise<DvtEligibility> {
  const dvt = readActions();
  const [boundNodeId, stakeOpen, minStake] = await Promise.all([
    dvt.operatorNode({ operator }),
    dvt.requireStake(),
    dvt.minStake(),
  ]);
  return { boundNodeId: isZeroHash(boundNodeId) ? null : boundNodeId, stakeOpen, minStake };
}

/** One-shot: build PoP from the secret key and submit `register`. */
export async function registerDvtNode(
  walletClient: WalletClient,
  blsSecretKey: Hex
): Promise<DvtRegisterResult> {
  return writeActions(walletClient).register({ blsSecretKey });
}

/**
 * HSM path: submit a PoP produced outside the browser via `registerWithProof`.
 */
export async function registerDvtNodeWithProof(
  walletClient: WalletClient,
  pop: Pick<DvtPop, "publicKey" | "popPoint" | "popSig">
): Promise<Hex> {
  return writeActions(walletClient).registerWithProof(pop);
}

/** Confirm a node id is registered on-chain (post-tx read-back). */
export async function isDvtNodeRegistered(
  _walletClient: WalletClient,
  nodeId: Hex
): Promise<boolean> {
  return readActions().isRegistered({ nodeId });
}
