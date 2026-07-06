"use client";

/**
 * Shared types for the DVT node-operator registration wizard.
 *
 * Registration is signed in the operator's own browser wallet (viem WalletClient
 * from WalletContext); the BLS **secret key lives only in this in-memory wizard
 * state** — never persisted to storage, never sent to the backend.
 *
 * @module app/operator/dvt-register/steps/types
 */
import type { Address, WalletClient } from "viem";
import type { DvtEligibility, DvtPop, Hex } from "@/lib/sdk/dvtOperator";

/** Cross-step wizard state, owned by page.tsx and threaded into each step. */
export interface DvtWizardData {
  /** On-chain eligibility snapshot (operatorNode / requireStake / minStake). */
  eligibility: DvtEligibility | null;
  /**
   * BLS node secret key — in-memory only, never persisted or transmitted.
   * Present once the operator generates or imports a key in the key step.
   */
  blsSecretKey?: Hex;
  /** Proof-of-possession + nodeId derived locally from `blsSecretKey`. */
  pop?: DvtPop;
  /** Registration tx hash once submitted. */
  registerTxHash?: Hex;
}

export const initialDvtWizardData: DvtWizardData = {
  eligibility: null,
};

/** Props every step component receives from the wizard container. */
export interface DvtStepProps {
  address: Address;
  walletClient: WalletClient;
  data: DvtWizardData;
  update: (patch: Partial<DvtWizardData>) => void;
  onNext: () => void;
  onBack?: () => void;
  /** Jump straight to the final step (used by the already-registered short-circuit). */
  onComplete?: () => void;
}
