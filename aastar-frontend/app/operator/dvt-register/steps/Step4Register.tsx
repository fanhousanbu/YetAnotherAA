"use client";

/**
 * Step 4 — submit the registration and confirm on-chain.
 *
 * `register({ blsSecretKey })` builds the PoP and submits in one tx; after the
 * receipt we read `isRegistered(nodeId)` back to confirm. `useTxStep` drives the
 * pending/confirmed/error UI, consistent with the deploy wizard.
 *
 * While the DVT SDK is unpublished (PR #288) the submit is disabled behind the
 * pending notice.
 *
 * @module app/operator/dvt-register/steps/Step4Register
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";
import StepCard from "@/app/operator/deploy/components/StepCard";
import WizardButton from "@/app/operator/deploy/components/WizardButton";
import { useTxStep } from "@/app/operator/deploy/components/useTxStep";
import { DVT_SDK_READY, isDvtNodeRegistered, registerDvtNode } from "@/lib/sdk/dvtOperator";
import PendingSdkNote from "../components/PendingSdkNote";
import type { DvtStepProps } from "./types";

export default function Step4Register({
  walletClient,
  data,
  update,
  onNext,
  onBack,
}: DvtStepProps) {
  const { t } = useTranslation();
  const { status, txHash, error, isBusy, run } = useTxStep();
  const [confirmError, setConfirmError] = useState<string | undefined>();

  const nodeId = data.pop?.nodeId;

  const handleRegister = async () => {
    if (!data.blsSecretKey) return;
    const hash = await run(
      async () => {
        const { hash } = await registerDvtNode(walletClient, data.blsSecretKey!);
        return hash;
      },
      {
        loadingMsg: t("dvtRegister.step4.submitting"),
        successMsg: t("dvtRegister.step4.submitted"),
      }
    );
    if (!hash) return;
    update({ registerTxHash: hash });
    // Best-effort read-back: the tx already confirmed, so a false/failed check
    // only warns (e.g. RPC lag) — it never undoes a landed registration.
    try {
      if (nodeId && !(await isDvtNodeRegistered(walletClient, nodeId))) {
        setConfirmError(t("dvtRegister.step4.confirmFailed"));
      }
    } catch (err) {
      setConfirmError(err instanceof Error ? err.message : String(err));
    }
    onNext();
  };

  return (
    <StepCard
      title={t("dvtRegister.step4.title")}
      description={t("dvtRegister.step4.description")}
      icon={<PaperAirplaneIcon className="h-6 w-6" />}
      status={status}
      txHash={txHash}
      error={error ?? confirmError}
      footer={
        <>
          {onBack && (
            <WizardButton variant="secondary" onClick={onBack} disabled={isBusy}>
              {t("dvtRegister.common.back")}
            </WizardButton>
          )}
          <WizardButton
            onClick={handleRegister}
            loading={isBusy}
            disabled={!DVT_SDK_READY || !data.blsSecretKey}
          >
            {t("dvtRegister.step4.register")}
          </WizardButton>
        </>
      }
    >
      {!DVT_SDK_READY && <PendingSdkNote />}

      {nodeId && (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 mb-0.5">{t("dvtRegister.step3.nodeId")}</p>
          <p className="text-xs font-mono break-all text-gray-700 dark:text-gray-300">{nodeId}</p>
        </div>
      )}

      <p className="text-xs text-gray-400">{t("dvtRegister.step4.hint")}</p>
    </StepCard>
  );
}
