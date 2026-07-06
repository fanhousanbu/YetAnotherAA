"use client";

/**
 * Step 1 — connect the operator wallet and introduce DVT node registration.
 * No on-chain writes here.
 *
 * @module app/operator/dvt-register/steps/Step1Connect
 */
import { useTranslation } from "react-i18next";
import { WalletIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { useWallet } from "@/contexts/WalletContext";
import StepCard from "@/app/operator/deploy/components/StepCard";
import WizardButton from "@/app/operator/deploy/components/WizardButton";

interface Step1Props {
  onNext: () => void;
}

export default function Step1Connect({ onNext }: Step1Props) {
  const { t } = useTranslation();
  const { address, isConnecting, hasInjectedWallet, connect } = useWallet();

  return (
    <StepCard
      title={t("dvtRegister.step1.title")}
      description={t("dvtRegister.step1.description")}
      icon={<WalletIcon className="h-6 w-6" />}
      footer={
        <>
          <span className="text-xs text-gray-400">
            {address ? (
              <span className="font-mono">
                {address.slice(0, 6)}…{address.slice(-4)}
              </span>
            ) : (
              t("dvtRegister.step1.walletNotConnected")
            )}
          </span>
          {address ? (
            <WizardButton onClick={onNext}>{t("dvtRegister.common.continue")}</WizardButton>
          ) : (
            <WizardButton onClick={connect} loading={isConnecting} disabled={!hasInjectedWallet}>
              {hasInjectedWallet
                ? t("dvtRegister.step1.connectWallet")
                : t("dvtRegister.step1.noWalletFound")}
            </WizardButton>
          )}
        </>
      }
    >
      <div className="rounded-xl bg-slate-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheckIcon className="h-5 w-5 text-slate-700 dark:text-emerald-400" />
          <span className="font-semibold text-gray-900 dark:text-white">
            {t("dvtRegister.step1.aboutTitle")}
          </span>
        </div>
        <ul className="space-y-1">
          {[1, 2, 3].map(n => (
            <li key={n} className="text-xs text-gray-600 dark:text-gray-300 flex gap-1.5">
              <span className="text-slate-400 dark:text-emerald-500">•</span>
              {t(`dvtRegister.step1.about${n}`)}
            </li>
          ))}
        </ul>
      </div>
    </StepCard>
  );
}
