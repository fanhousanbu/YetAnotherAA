/**
 * Slash-governance WRITE boundary (CC-13 batch B).
 *
 * Drives the BLSAggregator slash-policy admin surface behind an OpenZeppelin
 * TimelockController via the SDK's `@aastar/sdk/admin` `SlashGovernance` client
 * (multisig target locked to a TimelockController, per the SDK design).
 *
 * Two phases — the UI picks by comparing the current `slashPolicyAdmin` to the
 * connected EOA vs. the timelock:
 *
 *  1. **Bootstrap handoff** — while `slashPolicyAdmin` is still the deployer/
 *     operator EOA, a single `setSlashPolicyAdmin(timelock)` tx hands control to
 *     the timelock. This one is a DIRECT call by the current EOA admin (the
 *     timelock isn't admin yet, so it can't go through the timelock).
 *  2. **Governed changes** — once `slashPolicyAdmin == timelock`, editing the
 *     threshold table (or re-assigning the admin) is a `schedule()` → wait
 *     `getMinDelay()` → `execute()` flow that `SlashGovernance` encodes and drives.
 *
 * `salt` distinguishes otherwise-identical timelock operations and MUST be reused
 * verbatim across schedule / eta / execute — persisted here in localStorage,
 * keyed by the operation. Addresses come from `ensureSdkConfig`, never hardcoded.
 *
 * All writes are signed by the operator's own injected EOA (WalletContext); the
 * viem type identity differs from the SDK's bundled viem, so wallet/public
 * clients are handed in as `any` (see `manage/_components/shared`).
 *
 * @module lib/sdk/governanceWrite
 */
import type { Address, Hex, WalletClient } from "viem";
import { BLS_AGGREGATOR_ADDRESS, BLSAggregatorABI, SlashLevel } from "@aastar/sdk/core";
import { SlashGovernance } from "@aastar/sdk/admin";
import { ensureSdkConfig, getPublicClient } from "./client";

export { SlashLevel };

const TIMELOCK_LS_KEY = "yaaa.governance.timelockAddress";
const SALT_LS_PREFIX = "yaaa.governance.salt.";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

/** Minimal OZ TimelockController view ABI — just the delay getter for the UI. */
const TIMELOCK_ABI = [
  {
    type: "function",
    name: "getMinDelay",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

export function isAddress(v: string | null | undefined): v is Address {
  return !!v && ADDRESS_RE.test(v);
}

// ── Operator-provided timelock address (localStorage) ────────────────────────

export function getSavedTimelock(): Address | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(TIMELOCK_LS_KEY);
  return isAddress(v) ? (v as Address) : null;
}

export function saveTimelock(addr: Address): void {
  if (typeof window !== "undefined") window.localStorage.setItem(TIMELOCK_LS_KEY, addr);
}

// ── Salt persistence (schedule → eta → execute must reuse the same salt) ─────

/**
 * Deterministic localStorage key for a pending operation's salt. Same key ⇒ same
 * salt reused across schedule/eta/execute; a different `variant` mints a fresh op.
 */
function saltKey(op: string): string {
  return SALT_LS_PREFIX + op;
}

/** Return the persisted salt for `op`, or mint + persist a fresh 32-byte one. */
export function getOrCreateSalt(op: string): Hex {
  if (typeof window === "undefined") throw new Error("salt requires a browser context");
  const existing = window.localStorage.getItem(saltKey(op));
  if (existing && /^0x[0-9a-fA-F]{64}$/.test(existing)) return existing as Hex;
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  const salt = ("0x" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("")) as Hex;
  window.localStorage.setItem(saltKey(op), salt);
  return salt;
}

/** The persisted salt for `op`, or null if none scheduled yet. */
export function peekSalt(op: string): Hex | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(saltKey(op));
  return v && /^0x[0-9a-fA-F]{64}$/.test(v) ? (v as Hex) : null;
}

/** Drop a completed operation's salt so a later identical change gets a fresh one. */
export function clearSalt(op: string): void {
  if (typeof window !== "undefined") window.localStorage.removeItem(saltKey(op));
}

/** Op key for a threshold change (level + target quorum). */
export function thresholdOp(level: number, threshold: number): string {
  return `thr.${level}.${threshold}`;
}

// ── Reads ────────────────────────────────────────────────────────────────────

/** The timelock's minimum schedule→execute delay, in seconds. */
export async function fetchMinDelay(timelock: Address): Promise<bigint> {
  ensureSdkConfig();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getPublicClient() as any;
  return client.readContract({
    address: timelock,
    abi: TIMELOCK_ABI,
    functionName: "getMinDelay",
  }) as Promise<bigint>;
}

// ── Bootstrap handoff (direct EOA → timelock) ────────────────────────────────

/**
 * Hand `slashPolicyAdmin` from the connected EOA to the timelock in one tx.
 * Only valid while the connected wallet IS the current `slashPolicyAdmin`.
 */
export async function handoffAdminToTimelock(
  walletClient: WalletClient,
  timelock: Address
): Promise<Hex> {
  ensureSdkConfig();
  const aggregator = BLS_AGGREGATOR_ADDRESS as Address | undefined;
  if (!aggregator) throw new Error("BLS aggregator address unavailable.");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wc = walletClient as any;
  return wc.writeContract({
    address: aggregator,
    abi: BLSAggregatorABI,
    functionName: "setSlashPolicyAdmin",
    args: [timelock],
    account: wc.account,
    chain: wc.chain,
  }) as Promise<Hex>;
}

// ── Governed changes (via SlashGovernance timelock orchestration) ────────────

function slashGov(walletClient: WalletClient, timelock: Address): SlashGovernance {
  ensureSdkConfig();
  const aggregator = BLS_AGGREGATOR_ADDRESS as Address | undefined;
  if (!aggregator) throw new Error("BLS aggregator address unavailable.");
  return new SlashGovernance({
    // viem identity gap — see module doc.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: walletClient as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    publicClient: getPublicClient() as any,
    blsAggregatorAddress: aggregator,
    timelockAddress: timelock,
  });
}

/** Schedule a threshold change through the timelock; returns the schedule tx hash. */
export async function scheduleThreshold(
  walletClient: WalletClient,
  timelock: Address,
  level: number,
  threshold: number,
  salt: Hex
): Promise<Hex> {
  return slashGov(walletClient, timelock).scheduleSetSlashThreshold({
    slashLevel: level,
    threshold,
    salt,
  }) as Promise<Hex>;
}

/** Execute a previously-scheduled threshold change (after its ETA has elapsed). */
export async function executeThreshold(
  walletClient: WalletClient,
  timelock: Address,
  level: number,
  threshold: number,
  salt: Hex
): Promise<Hex> {
  return slashGov(walletClient, timelock).executeSetSlashThreshold({
    slashLevel: level,
    threshold,
    salt,
  }) as Promise<Hex>;
}

/**
 * ETA for a scheduled threshold change: `0n` = not scheduled, `1n` = already
 * executed, else the unix timestamp (seconds) at which it becomes executable.
 */
export async function thresholdEta(
  walletClient: WalletClient,
  timelock: Address,
  level: number,
  threshold: number,
  salt: Hex
): Promise<bigint> {
  return slashGov(walletClient, timelock).getSetSlashThresholdEta({
    slashLevel: level,
    threshold,
    salt,
  });
}
