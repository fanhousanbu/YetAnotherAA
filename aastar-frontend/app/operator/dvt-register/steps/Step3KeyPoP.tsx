"use client";

/**
 * Step 3 — obtain the BLS node key and derive the proof-of-possession.
 *
 * The operator either generates a fresh key in the browser or pastes an existing
 * one. `buildDvtPop` (pure/local in the SDK) then derives `{ publicKey, popPoint,
 * popSig, nodeId }`, letting us preview the nodeId before any tx.
 *
 * SECURITY: the BLS secret key is held only in in-memory wizard state — it is
 * never written to storage nor sent to the backend. The UI warns the operator to
 * back it up offline.
 *
 * While the DVT SDK is unpublished (PR #288), `buildDvtPop` is stubbed: key
 * generation/import still works locally, and the nodeId preview shows a pending
 * notice.
 *
 * @module app/operator/dvt-register/steps/Step3KeyPoP
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyIcon, ExclamationTriangleIcon, SparklesIcon } from "@heroicons/react/24/outline";
import StepCard from "@/app/operator/deploy/components/StepCard";
import WizardButton from "@/app/operator/deploy/components/WizardButton";
import FormField from "@/app/operator/deploy/components/FormField";
import {
  buildDvtPop,
  generateBlsSecretKey,
  normalizeBlsSecretKey,
  type Hex,
} from "@/lib/sdk/dvtOperator";
import PendingSdkNote from "../components/PendingSdkNote";
import type { DvtStepProps } from "./types";

export default function Step3KeyPoP({ data, update, onNext, onBack }: DvtStepProps) {
  const { t } = useTranslation();
  const [keyInput, setKeyInput] = useState<string>(data.blsSecretKey ?? "");
  const [error, setError] = useState<string | undefined>();

  const applyKey = (secret: Hex) => {
    setError(undefined);
    // Only commit the key once its PoP derives — an out-of-range key (e.g. a
    // pasted scalar ≥ curve order) must not advance the wizard to registration.
    try {
      const pop = buildDvtPop(secret);
      update({ blsSecretKey: secret, pop });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      update({ blsSecretKey: undefined, pop: undefined });
    }
  };

  const handleGenerate = () => {
    const secret = generateBlsSecretKey();
    setKeyInput(secret);
    applyKey(secret);
  };

  const handleImport = () => {
    try {
      const secret = normalizeBlsSecretKey(keyInput);
      setKeyInput(secret);
      applyKey(secret);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const hasKey = !!data.blsSecretKey;

  return (
    <StepCard
      title={t("dvtRegister.step3.title")}
      description={t("dvtRegister.step3.description")}
      icon={<KeyIcon className="h-6 w-6" />}
      error={error}
      footer={
        <>
          {onBack && (
            <WizardButton variant="secondary" onClick={onBack}>
              {t("dvtRegister.common.back")}
            </WizardButton>
          )}
          <WizardButton onClick={onNext} disabled={!hasKey}>
            {t("dvtRegister.common.continue")}
          </WizardButton>
        </>
      }
    >
      <div className="flex items-start gap-2 text-sm rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-red-700 dark:text-red-300">
        <ExclamationTriangleIcon className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{t("dvtRegister.step3.keyWarning")}</span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <FormField
              label={t("dvtRegister.step3.keyLabel")}
              value={keyInput}
              onChange={setKeyInput}
              placeholder="0x…"
              mono
              hint={t("dvtRegister.step3.keyHint")}
            />
          </div>
          <WizardButton variant="secondary" onClick={handleImport} disabled={!keyInput.trim()}>
            {t("dvtRegister.step3.import")}
          </WizardButton>
        </div>
        <button
          type="button"
          onClick={handleGenerate}
          className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-slate-700 dark:text-emerald-400 hover:underline"
        >
          <SparklesIcon className="h-4 w-4" />
          {t("dvtRegister.step3.generate")}
        </button>
      </div>

      {hasKey && (
        <div className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4 space-y-2">
          <p className="text-xs text-gray-500">{t("dvtRegister.step3.previewTitle")}</p>
          {data.pop ? (
            <>
              <Field label={t("dvtRegister.step3.nodeId")} value={data.pop.nodeId} />
              <Field label={t("dvtRegister.step3.publicKey")} value={data.pop.publicKey} />
            </>
          ) : (
            <PendingSdkNote />
          )}
        </div>
      )}
    </StepCard>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-xs font-mono break-all text-gray-700 dark:text-gray-300">{value}</p>
    </div>
  );
}
