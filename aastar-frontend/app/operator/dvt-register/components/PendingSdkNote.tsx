"use client";

/**
 * Inline notice shown while the DVT SDK actions are not yet published (PR #288).
 * Makes it unmistakable that on-chain steps are stubbed pending @aastar/sdk.
 *
 * @module app/operator/dvt-register/components/PendingSdkNote
 */
import { useTranslation } from "react-i18next";
import { WrenchIcon } from "@heroicons/react/24/outline";

export default function PendingSdkNote() {
  const { t } = useTranslation();
  return (
    <div className="flex items-start gap-2 text-sm rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-amber-800 dark:text-amber-300">
      <WrenchIcon className="h-4 w-4 shrink-0 mt-0.5" />
      <span>{t("dvtRegister.pendingSdk")}</span>
    </div>
  );
}
