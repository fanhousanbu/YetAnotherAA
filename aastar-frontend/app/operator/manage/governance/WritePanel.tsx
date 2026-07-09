"use client";

/**
 * Slash-governance WRITE panel (CC-13 batch B).
 *
 * Renders the two operator write flows against the BLSAggregator slash-policy
 * admin, gated on the current `slashPolicyAdmin`:
 *
 *  - Bootstrap: while the connected EOA IS the admin, hand it to a
 *    TimelockController in one tx (two-click confirm — this moves control).
 *  - Governed: once the admin IS the configured timelock, edit a threshold via
 *    schedule → wait minDelay → execute (salt persisted across the two txs).
 *
 * All state/logic lives in `lib/sdk/governanceWrite.ts`; this is presentation +
 * the operator's own wallet signing (WalletContext).
 *
 * @module app/operator/manage/governance/WritePanel
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import toast from "react-hot-toast";
import { ArrowPathIcon, ShieldCheckIcon, ClockIcon } from "@heroicons/react/24/outline";
import type { Address } from "viem";
import { useWallet } from "@/contexts/WalletContext";
import type { SlashThreshold } from "@/lib/sdk/governance";
import {
  fetchMinDelay,
  handoffAdminToTimelock,
  scheduleThreshold,
  executeThreshold,
  thresholdEta,
  getOrCreateSalt,
  peekSalt,
  clearSalt,
  thresholdOp,
  getSavedTimelock,
  saveTimelock,
  isAddress,
  SlashLevel,
} from "@/lib/sdk/governanceWrite";
import {
  Section,
  MetricCard,
  ErrorBox,
  shortAddr,
  addrUrl,
  eqAddr,
  errMsg,
} from "../_components/shared";

interface WritePanelProps {
  slashPolicyAdmin: Address;
  thresholds: SlashThreshold[];
  onChanged: () => void;
}

const LEVELS = [
  { level: SlashLevel.WARNING, key: "warning" },
  { level: SlashLevel.MINOR, key: "minor" },
  { level: SlashLevel.MAJOR, key: "major" },
];

function fmtEta(eta: bigint, nowSec: number): { ready: boolean; label: string } {
  if (eta === 0n) return { ready: false, label: "" };
  if (eta === 1n) return { ready: true, label: "" };
  const remaining = Number(eta) - nowSec;
  if (remaining <= 0) return { ready: true, label: "" };
  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  return { ready: false, label: `${h}h ${m}m` };
}

export default function WritePanel({ slashPolicyAdmin, thresholds, onChanged }: WritePanelProps) {
  const { t } = useTranslation();
  const { address, walletClient } = useWallet();

  const [timelock, setTimelock] = useState<Address | null>(null);
  const [timelockInput, setTimelockInput] = useState("");
  const [minDelay, setMinDelay] = useState<bigint | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmHandoff, setConfirmHandoff] = useState(false);

  // Threshold form + the pending scheduled op's ETA.
  const [level, setLevel] = useState<number>(SlashLevel.WARNING);
  const [target, setTarget] = useState("");
  const [eta, setEta] = useState<bigint>(0n);
  const [nowSec, setNowSec] = useState(() => 0);

  useEffect(() => {
    setTimelock(getSavedTimelock());
    setNowSec(Math.floor(Date.now() / 1000));
    const id = setInterval(() => setNowSec(Math.floor(Date.now() / 1000)), 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!timelock) return;
    fetchMinDelay(timelock)
      .then(setMinDelay)
      .catch(e => setError(errMsg(e)));
  }, [timelock]);

  const isBootstrap = !!address && eqAddr(slashPolicyAdmin, address);
  const isGoverned = !!timelock && eqAddr(slashPolicyAdmin, timelock);

  // Refresh the ETA for the currently-typed (level, target) op if one was scheduled.
  const refreshEta = useCallback(async () => {
    const th = Number(target);
    if (!walletClient || !timelock || !Number.isInteger(th) || th < 1) {
      setEta(0n);
      return;
    }
    const salt = peekSalt(thresholdOp(level, th));
    if (!salt) {
      setEta(0n);
      return;
    }
    try {
      setEta(await thresholdEta(walletClient, timelock, level, th, salt));
    } catch {
      setEta(0n);
    }
  }, [walletClient, timelock, level, target]);

  useEffect(() => {
    void refreshEta();
  }, [refreshEta, nowSec]);

  const onSaveTimelock = () => {
    if (!isAddress(timelockInput)) {
      setError(t("operatorManage.governance.write.badTimelock"));
      return;
    }
    saveTimelock(timelockInput);
    setTimelock(timelockInput);
    setTimelockInput("");
    setError("");
  };

  const onHandoff = async () => {
    if (!walletClient || !timelock) return;
    if (!confirmHandoff) {
      setConfirmHandoff(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const hash = await handoffAdminToTimelock(walletClient, timelock);
      toast.success(t("operatorManage.governance.write.handoffSent"));
      toast(shortAddr(hash));
      setConfirmHandoff(false);
      onChanged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const onSchedule = async () => {
    const th = Number(target);
    if (!walletClient || !timelock || !Number.isInteger(th) || th < 1) {
      setError(t("operatorManage.governance.write.badThreshold"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const salt = getOrCreateSalt(thresholdOp(level, th));
      const hash = await scheduleThreshold(walletClient, timelock, level, th, salt);
      toast.success(t("operatorManage.governance.write.scheduled"));
      toast(shortAddr(hash));
      await refreshEta();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const onExecute = async () => {
    const th = Number(target);
    const salt = peekSalt(thresholdOp(level, th));
    if (!walletClient || !timelock || !salt) return;
    setBusy(true);
    setError("");
    try {
      const hash = await executeThreshold(walletClient, timelock, level, th, salt);
      toast.success(t("operatorManage.governance.write.executed"));
      toast(shortAddr(hash));
      clearSalt(thresholdOp(level, th));
      setEta(0n);
      setTarget("");
      onChanged();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const etaState = fmtEta(eta, nowSec);
  const delayLabel =
    minDelay == null ? "—" : `${Math.round(Number(minDelay) / 3600)}h (${minDelay.toString()}s)`;

  return (
    <Section title={t("operatorManage.governance.writeSection")}>
      <div className="space-y-5">
        <ErrorBox message={error} />

        {/* Timelock config */}
        <div>
          <p className="text-xs text-gray-500 mb-1">
            {t("operatorManage.governance.write.timelockLabel")}
          </p>
          {timelock ? (
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={addrUrl(timelock)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {shortAddr(timelock)} ↗
              </a>
              <span className="text-xs text-gray-400">
                {t("operatorManage.governance.write.minDelay")}: {delayLabel}
              </span>
              <button
                onClick={() => {
                  setTimelock(null);
                  setMinDelay(null);
                }}
                className="text-xs text-gray-400 hover:text-emerald-600"
              >
                {t("operatorManage.governance.write.changeTimelock")}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <input
                value={timelockInput}
                onChange={e => setTimelockInput(e.target.value.trim())}
                placeholder="0x… TimelockController"
                className="flex-1 min-w-[16rem] px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm font-mono"
              />
              <button
                onClick={onSaveTimelock}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium"
              >
                {t("operatorManage.governance.write.saveTimelock")}
              </button>
            </div>
          )}
        </div>

        {!timelock ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t("operatorManage.governance.write.needTimelock")}
          </p>
        ) : isBootstrap ? (
          /* Phase 1 — bootstrap handoff */
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-3">
            <div className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
              <ShieldCheckIcon className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{t("operatorManage.governance.write.handoffPrompt")}</span>
            </div>
            <button
              onClick={() => void onHandoff()}
              disabled={busy}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 ${
                confirmHandoff ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
              }`}
            >
              {busy && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              {confirmHandoff
                ? t("operatorManage.governance.write.handoffConfirm")
                : t("operatorManage.governance.write.handoffButton")}
            </button>
            {confirmHandoff && !busy && (
              <button
                onClick={() => setConfirmHandoff(false)}
                className="ml-2 text-xs text-gray-500 hover:text-gray-700"
              >
                {t("operatorManage.governance.write.cancel")}
              </button>
            )}
          </div>
        ) : isGoverned ? (
          /* Phase 2 — governed threshold change */
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {t("operatorManage.governance.write.governedPrompt")}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {thresholds.map(th => (
                <MetricCard
                  key={th.level}
                  label={t(`operatorManage.governance.level.${th.key}`)}
                  value={String(th.threshold)}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="block text-xs text-gray-500 mb-1">
                  {t("operatorManage.governance.write.levelLabel")}
                </span>
                <select
                  value={level}
                  onChange={e => setLevel(Number(e.target.value))}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                >
                  {LEVELS.map(l => (
                    <option key={l.level} value={l.level}>
                      {t(`operatorManage.governance.level.${l.key}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="block text-xs text-gray-500 mb-1">
                  {t("operatorManage.governance.write.newThreshold")}
                </span>
                <input
                  type="number"
                  min={1}
                  value={target}
                  onChange={e => setTarget(e.target.value)}
                  placeholder="3"
                  className="w-24 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
                />
              </label>

              {etaState.ready ? (
                <button
                  onClick={() => void onExecute()}
                  disabled={busy}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium"
                >
                  {busy && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  {t("operatorManage.governance.write.execute")}
                </button>
              ) : eta > 1n ? (
                <span className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-500">
                  <ClockIcon className="h-4 w-4" />
                  {t("operatorManage.governance.write.readyIn", { eta: etaState.label })}
                </span>
              ) : (
                <button
                  onClick={() => void onSchedule()}
                  disabled={busy}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium"
                >
                  {busy && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  {t("operatorManage.governance.write.schedule")}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400">{t("operatorManage.governance.write.saltNote")}</p>
          </div>
        ) : (
          /* Admin is neither the connected EOA nor the configured timelock */
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {t("operatorManage.governance.write.notAdmin", {
              admin: shortAddr(slashPolicyAdmin),
            })}
          </div>
        )}
      </div>
    </Section>
  );
}
