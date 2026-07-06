"use client";

/**
 * Step 2 — check on-chain eligibility.
 *
 *  - `operatorNode(operator)` non-zero → operator already runs a node: short-circuit
 *    to the final step showing the bound nodeId.
 *  - else surface stake status (`requireStake` / `minStake`); if the operator has
 *    not staked ROLE_DVT, guide them to staking before continuing.
 *
 * While the DVT SDK is unpublished (PR #288) the read is stubbed: the step shows
 * the pending notice and lets the operator walk the rest of the wizard.
 *
 * @module app/operator/dvt-register/steps/Step2Eligibility
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatEther } from "viem";
import { ClipboardDocumentCheckIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import StepCard from "@/app/operator/deploy/components/StepCard";
import WizardButton from "@/app/operator/deploy/components/WizardButton";
import {
  DVT_SDK_READY,
  fetchDvtEligibility,
  type DvtEligibility,
  type Hex,
} from "@/lib/sdk/dvtOperator";
import PendingSdkNote from "../components/PendingSdkNote";
import type { DvtStepProps } from "./types";

export default function Step2Eligibility({
  address,
  walletClient,
  data,
  update,
  onNext,
  onBack,
  onComplete,
}: DvtStepProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const eligibility = data.eligibility;

  const load = useCallback(async () => {
    if (!DVT_SDK_READY) return;
    setLoading(true);
    setError(undefined);
    try {
      const result: DvtEligibility = await fetchDvtEligibility(walletClient, address as Hex);
      update({ eligibility: result });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [address, walletClient, update]);

  useEffect(() => {
    if (DVT_SDK_READY && !eligibility) void load();
  }, [eligibility, load]);

  const alreadyRegistered = !!eligibility?.boundNodeId;

  return (
    <StepCard
      title={t("dvtRegister.step2.title")}
      description={t("dvtRegister.step2.description")}
      icon={<ClipboardDocumentCheckIcon className="h-6 w-6" />}
      error={error}
      footer={
        <>
          {onBack && (
            <WizardButton variant="secondary" onClick={onBack}>
              {t("dvtRegister.common.back")}
            </WizardButton>
          )}
          {alreadyRegistered ? (
            <WizardButton onClick={() => onComplete?.()}>
              {t("dvtRegister.step2.viewNode")}
            </WizardButton>
          ) : (
            <WizardButton onClick={onNext} loading={loading}>
              {t("dvtRegister.common.continue")}
            </WizardButton>
          )}
        </>
      }
    >
      {!DVT_SDK_READY && <PendingSdkNote />}

      {DVT_SDK_READY && loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ArrowPathIcon className="h-4 w-4 animate-spin" />
          {t("dvtRegister.step2.checking")}
        </div>
      )}

      {alreadyRegistered && eligibility?.boundNodeId && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300 mb-1">
            {t("dvtRegister.step2.alreadyRegistered")}
          </p>
          <p className="text-xs font-mono break-all text-emerald-700 dark:text-emerald-400">
            {eligibility.boundNodeId}
          </p>
        </div>
      )}

      {!alreadyRegistered && eligibility && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4">
            <dt className="text-xs text-gray-500 mb-1">{t("dvtRegister.step2.stakeOpen")}</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {eligibility.stakeOpen
                ? t("dvtRegister.step2.stakeOpenYes")
                : t("dvtRegister.step2.stakeOpenNo")}
            </dd>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-gray-900 p-4">
            <dt className="text-xs text-gray-500 mb-1">{t("dvtRegister.step2.minStake")}</dt>
            <dd className="text-sm font-semibold text-gray-900 dark:text-white">
              {formatEther(eligibility.minStake)} GTOKEN
            </dd>
          </div>
        </dl>
      )}

      <p className="text-xs text-gray-400">{t("dvtRegister.step2.stakeHint")}</p>
    </StepCard>
  );
}
