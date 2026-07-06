"use client";

/**
 * DVT node-operator registration wizard (aastar-sdk#279 / PR #288).
 *
 * Turns the manual operator registration script into a guided flow, fully
 * client-side: the operator's own browser wallet (viem WalletClient from
 * WalletContext) signs `registerWithProof` against the AAStarValidator, and the
 * BLS secret key never leaves the browser.
 *
 *   connect → eligibility → key & PoP → register → done
 *
 * The eligibility step short-circuits to `done` when the operator already runs a
 * node. On-chain/crypto calls are behind the {@link lib/sdk/dvtOperator} boundary,
 * stubbed until @aastar/sdk 0.37.4/0.38.0 publishes the DVT actions.
 *
 * @module app/operator/dvt-register/page
 */
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { CpuChipIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import Layout from "@/components/Layout";
import { useWallet } from "@/contexts/WalletContext";
import WizardProgress from "@/app/operator/deploy/components/WizardProgress";
import WizardButton from "@/app/operator/deploy/components/WizardButton";
import { initialDvtWizardData, type DvtStepProps, type DvtWizardData } from "./steps/types";
import Step1Connect from "./steps/Step1Connect";
import Step2Eligibility from "./steps/Step2Eligibility";
import Step3KeyPoP from "./steps/Step3KeyPoP";
import Step4Register from "./steps/Step4Register";
import StepComplete from "./steps/StepComplete";

const STEP_KEYS = ["connect", "eligibility", "key", "register", "done"] as const;
const LABEL_KEYS: Record<(typeof STEP_KEYS)[number], string> = {
  connect: "dvtRegister.labels.connect",
  eligibility: "dvtRegister.labels.eligibility",
  key: "dvtRegister.labels.key",
  register: "dvtRegister.labels.register",
  done: "dvtRegister.labels.done",
};

export default function DvtRegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { address, walletClient } = useWallet();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<DvtWizardData>(initialDvtWizardData);

  const update = useCallback((patch: Partial<DvtWizardData>) => {
    setData(prev => ({ ...prev, ...patch }));
  }, []);

  const onNext = useCallback(() => setStep(s => Math.min(s + 1, STEP_KEYS.length - 1)), []);
  const onBack = useCallback(() => setStep(s => Math.max(s - 1, 0)), []);
  const onComplete = useCallback(() => setStep(STEP_KEYS.length - 1), []);
  const restart = useCallback(() => {
    setData(initialDvtWizardData);
    setStep(0);
  }, []);

  const currentKey = STEP_KEYS[step];
  const needWallet = step > 0 && (!address || !walletClient);

  const stepProps: DvtStepProps | null =
    address && walletClient
      ? { address, walletClient, data, update, onNext, onBack, onComplete }
      : null;

  const labels = useMemo(() => STEP_KEYS.map(k => t(LABEL_KEYS[k])), [t]);

  const renderStep = () => {
    if (currentKey === "connect") {
      return <Step1Connect onNext={onNext} />;
    }
    if (needWallet || !stepProps) {
      return (
        <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <ExclamationTriangleIcon className="h-6 w-6" />
            <span className="font-semibold">{t("dvtRegister.page.walletDisconnected")}</span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {t("dvtRegister.page.reconnectPrompt")}
          </p>
          <WizardButton onClick={restart}>{t("dvtRegister.page.backToStart")}</WizardButton>
        </section>
      );
    }
    switch (currentKey) {
      case "eligibility":
        return <Step2Eligibility {...stepProps} />;
      case "key":
        return <Step3KeyPoP {...stepProps} />;
      case "register":
        return <Step4Register {...stepProps} />;
      case "done":
        return (
          <StepComplete data={data} onDone={() => router.push("/operator")} onRestart={restart} />
        );
      default:
        return null;
    }
  };

  return (
    <Layout requireAuth>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CpuChipIcon className="h-7 w-7 text-slate-700 dark:text-emerald-400" />
            {t("dvtRegister.page.title")}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t("dvtRegister.page.subtitle")}
          </p>
        </div>

        <WizardProgress labels={labels} current={step} />

        {renderStep()}
      </div>
    </Layout>
  );
}
