/**
 * Slash-governance read boundary (CC-13 coordination task).
 *
 * Surfaces the SuperPaymaster BLSAggregator's slash-policy governance state —
 * the threshold-table admin, the per-severity slash thresholds, and the
 * registered DVT validator/slot table — for the operator "Slash Governance"
 * management page (`app/operator/manage/governance`).
 *
 * READ-ONLY, no SDK bump needed: the deployed BLSAggregator ABI already ships in
 * `@aastar/sdk` (`BLSAggregatorABI` + `BLS_AGGREGATOR_ADDRESS`, populated by
 * `applyConfig` via `ensureSdkConfig`). The convenience wrapper
 * `aggregatorActions().getSlashThresholds()` landed in SDK 0.39.2, but the
 * underlying views (`slashPolicyAdmin` / `slashThresholds(level)` /
 * `validatorAtSlot(slot)`) are in the deployed ABI today, so reads work now.
 *
 * WRITE side — hand `slashPolicyAdmin` to a TimelockController and edit the
 * threshold table — goes through the SDK's `SlashGovernance` orchestrator
 * (schedule → wait minDelay → execute, batch B / 0.39.3). Not wired here yet;
 * see `GOVERNANCE_WRITE_READY`. The page shows a pending notice until it lands.
 *
 * @module lib/sdk/governance
 */
import type { Address } from "viem";
import { BLSAggregatorABI, BLS_AGGREGATOR_ADDRESS } from "@aastar/sdk/core";
import { ensureSdkConfig, getPublicClient } from "./client";

/** Timelock-orchestrated writes (setSlashPolicyAdmin / setSlashThreshold) not wired yet. */
export const GOVERNANCE_WRITE_READY = false;

/**
 * Temporary bridge for the CC-18 gap: SDK 0.38.0's canonical
 * `BLS_AGGREGATOR_ADDRESS` still points at the pre-#330 aggregator (which lacks
 * the slash getters), so ops can point this page at the new aggregator via
 * `NEXT_PUBLIC_BLS_AGGREGATOR_ADDRESS` until the SDK address refresh (CC-18)
 * ships. Returns undefined (→ SDK canonical) when unset.
 */
function getAggregatorOverride(): string | undefined {
  const v = process.env.NEXT_PUBLIC_BLS_AGGREGATOR_ADDRESS;
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? v : undefined;
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/** BLSAggregator slot count (signerMask bit `s-1` ⇔ validator at slot `s`). */
const MAX_SLOTS = 13;

/** Slash severities as encoded on-chain (uint8): WARNING=0, MINOR=1, MAJOR=2. */
export const SLASH_LEVELS = [
  { level: 0, key: "warning" },
  { level: 1, key: "minor" },
  { level: 2, key: "major" },
] as const;

export interface SlashThreshold {
  /** On-chain severity level (0/1/2). */
  level: number;
  /** i18n key suffix under `operatorManage.governance.level`. */
  key: string;
  /** Number of validator co-signatures required at this severity. */
  threshold: number;
}

export interface ValidatorSlot {
  /** 1-indexed BLSAggregator slot. */
  slot: number;
  /** Validator address registered at the slot. */
  validator: Address;
}

export interface SlashGovernanceState {
  /** The BLSAggregator the state was read from. */
  aggregator: Address;
  /** Address allowed to edit the threshold table (bootstrap = deployer EOA). */
  slashPolicyAdmin: Address;
  /** Per-severity co-signature thresholds. */
  thresholds: SlashThreshold[];
  /** Occupied validator slots only (zero-address slots filtered out). */
  validators: ValidatorSlot[];
}

/**
 * Read the current slash-policy governance state from the on-chain BLSAggregator.
 * Pure reads over a `PublicClient`; no wallet required.
 */
export async function fetchSlashGovernanceState(): Promise<SlashGovernanceState> {
  ensureSdkConfig();
  // @aastar/core bundles its own viem copy, so the PublicClient type identity
  // differs from the frontend's; handles are structurally identical at runtime.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = getPublicClient() as any;

  // The slash getters (slashPolicyAdmin / slashThresholds) live on the NEW
  // BLSAggregator deployed by SP #330. SDK 0.38.0 ships that new ABI but its
  // canonical `BLS_AGGREGATOR_ADDRESS` still points at the OLD aggregator (the
  // address refresh is CC-18, gated on the on-chain applyBLSAggregator). Until
  // the SDK canonical is bumped, an ops env override bridges the gap; once CC-18
  // lands, unset the env and the SDK canonical takes over automatically. The
  // address is never hardcoded in source.
  const aggregator = (getAggregatorOverride() ?? BLS_AGGREGATOR_ADDRESS) as Address | undefined;
  if (!aggregator) {
    throw new Error("BLS aggregator address unavailable — SDK config not applied.");
  }

  const read = (functionName: string, args: readonly unknown[] = []) =>
    client.readContract({ address: aggregator, abi: BLSAggregatorABI, functionName, args });

  const [slashPolicyAdmin, thresholdVals, slotVals] = await Promise.all([
    read("slashPolicyAdmin") as Promise<Address>,
    Promise.all(
      SLASH_LEVELS.map(l => read("slashThresholds", [l.level]) as Promise<number | bigint>)
    ),
    Promise.all(
      Array.from(
        { length: MAX_SLOTS },
        (_, i) => read("validatorAtSlot", [i + 1]) as Promise<Address>
      )
    ),
  ]);

  const thresholds: SlashThreshold[] = SLASH_LEVELS.map((l, i) => ({
    level: l.level,
    key: l.key,
    threshold: Number(thresholdVals[i]),
  }));

  const validators: ValidatorSlot[] = slotVals
    .map((validator, i) => ({ slot: i + 1, validator }))
    .filter(v => v.validator && v.validator.toLowerCase() !== ZERO_ADDRESS);

  return { aggregator, slashPolicyAdmin, thresholds, validators };
}
