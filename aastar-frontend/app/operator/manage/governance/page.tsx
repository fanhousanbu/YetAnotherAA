"use client";

/**
 * Slash Governance config — operator view of the SuperPaymaster BLSAggregator's
 * slash-policy state (CC-13 coordination task).
 *
 * Reads (view-only, no wallet writes): `slashPolicyAdmin` (threshold-table admin,
 * bootstrap = deployer EOA), the per-severity `slashThresholds` (WARNING 2 /
 * MINOR 3 / MAJOR 3), and the registered DVT validator/slot table
 * (`validatorAtSlot` 1..13). All via `lib/sdk/governance.ts` over a PublicClient;
 * addresses come from `ensureSdkConfig`, never hardcoded.
 *
 * The WRITE flow — hand `slashPolicyAdmin` to a TimelockController + edit the
 * threshold table via the SDK's `SlashGovernance` orchestrator — is not wired
 * yet (`GOVERNANCE_WRITE_READY=false`); a pending notice stands in for it.
 *
 * @module app/operator/manage/governance/page
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon, ArrowPathIcon, ScaleIcon, WrenchIcon } from "@heroicons/react/24/outline";
import Layout from "@/components/Layout";
import {
  fetchSlashGovernanceState,
  GOVERNANCE_WRITE_READY,
  type SlashGovernanceState,
} from "@/lib/sdk/governance";
import {
  ConnectGate,
  Section,
  MetricCard,
  Spinner,
  ErrorBox,
  shortAddr,
  addrUrl,
  errMsg,
} from "../_components/shared";

export default function OperatorGovernancePage() {
  const { t } = useTranslation();
  const [state, setState] = useState<SlashGovernanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setState(await fetchSlashGovernanceState());
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const validatorCount = state?.validators.length ?? 0;

  return (
    <Layout requireAuth>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <Link
            href="/operator/manage"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-400"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            {t("operatorManage.hub.title")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ScaleIcon className="h-7 w-7 text-slate-700 dark:text-emerald-400" />
            {t("operatorManage.governance.title")}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t("operatorManage.governance.subtitle")}
          </p>
        </div>

        <ConnectGate>
          {loading ? (
            <Spinner />
          ) : error ? (
            <Section
              title={t("operatorManage.governance.title")}
              action={
                <button
                  onClick={() => void load()}
                  className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  {t("operatorManage.shared.refresh")}
                </button>
              }
            >
              <ErrorBox message={error} />
            </Section>
          ) : state ? (
            <div className="space-y-6">
              {/* Threshold admin */}
              <Section
                title={t("operatorManage.governance.adminSection")}
                action={
                  <button
                    onClick={() => void load()}
                    className="inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    {t("operatorManage.shared.refresh")}
                  </button>
                }
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <MetricCard
                    label={t("operatorManage.governance.adminLabel")}
                    value={shortAddr(state.slashPolicyAdmin)}
                    mono
                    sub={t("operatorManage.governance.adminHint")}
                  />
                  <MetricCard
                    label={t("operatorManage.governance.aggregator")}
                    value={shortAddr(state.aggregator)}
                    mono
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-4 text-xs">
                  <a
                    href={addrUrl(state.slashPolicyAdmin)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {t("operatorManage.governance.adminLabel")} ↗
                  </a>
                  <a
                    href={addrUrl(state.aggregator)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    {t("operatorManage.governance.aggregator")} ↗
                  </a>
                </div>
              </Section>

              {/* Slash thresholds */}
              <Section title={t("operatorManage.governance.thresholdsSection")}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {state.thresholds.map(th => (
                    <MetricCard
                      key={th.level}
                      label={t(`operatorManage.governance.level.${th.key}`)}
                      value={String(th.threshold)}
                      unit={t("operatorManage.governance.thresholdUnit", {
                        count: validatorCount,
                      })}
                    />
                  ))}
                </div>
              </Section>

              {/* Registered validators / slots */}
              <Section title={t("operatorManage.governance.validatorsSection")}>
                {validatorCount === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t("operatorManage.governance.noValidators")}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {state.validators.map(v => (
                          <tr key={v.slot}>
                            <td className="py-2 pr-4 text-gray-500 whitespace-nowrap">
                              {t("operatorManage.governance.slot", { slot: v.slot })}
                            </td>
                            <td className="py-2 font-mono">
                              <a
                                href={addrUrl(v.validator)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 dark:text-emerald-400 hover:underline break-all"
                              >
                                {shortAddr(v.validator)} ↗
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              {/* Write flow — pending SDK SlashGovernance orchestrator */}
              {!GOVERNANCE_WRITE_READY && (
                <Section title={t("operatorManage.governance.writeSection")}>
                  <div className="flex items-start gap-2 text-sm rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-amber-800 dark:text-amber-300">
                    <WrenchIcon className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{t("operatorManage.governance.writePending")}</span>
                  </div>
                </Section>
              )}
            </div>
          ) : null}
        </ConnectGate>
      </div>
    </Layout>
  );
}
