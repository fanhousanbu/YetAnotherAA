"use client";

/**
 * Final step — show the registered nodeId (fresh registration or the pre-existing
 * bound node from the eligibility short-circuit) and the tx link.
 *
 * @module app/operator/dvt-register/steps/StepComplete
 */
import { useTranslation } from "react-i18next";
import { CheckCircleIcon, ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import StepCard, { explorerTx } from "@/app/operator/deploy/components/StepCard";
import WizardButton from "@/app/operator/deploy/components/WizardButton";
import type { DvtWizardData } from "./types";

interface StepCompleteProps {
  data: DvtWizardData;
  onDone: () => void;
  onRestart: () => void;
}

export default function StepComplete({ data, onDone, onRestart }: StepCompleteProps) {
  const { t } = useTranslation();
  const nodeId = data.pop?.nodeId ?? data.eligibility?.boundNodeId ?? undefined;

  return (
    <StepCard
      title={t("dvtRegister.done.title")}
      description={t("dvtRegister.done.description")}
      icon={<CheckCircleIcon className="h-6 w-6 text-emerald-500" />}
      footer={
        <>
          <WizardButton variant="secondary" onClick={onRestart}>
            {t("dvtRegister.done.registerAnother")}
          </WizardButton>
          <WizardButton onClick={onDone}>{t("dvtRegister.done.backToOperator")}</WizardButton>
        </>
      }
    >
      {nodeId && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-4">
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-0.5">
            {t("dvtRegister.step3.nodeId")}
          </p>
          <p className="text-sm font-mono break-all text-emerald-800 dark:text-emerald-300">
            {nodeId}
          </p>
        </div>
      )}

      {data.registerTxHash && (
        <a
          href={explorerTx(data.registerTxHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-slate-700 dark:text-emerald-400 hover:underline"
        >
          {t("dvtRegister.done.viewTx")}
          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
        </a>
      )}
    </StepCard>
  );
}
