"use client";

/**
 * Community xPNTs economic-credibility disclosure (CC-33).
 *
 * Lists every community xPNTs token with its on-chain credibility score (0–100
 * backing coverage) and an over-issue warning, then discloses the audit/slash
 * rules behind the score (sourced from DVT `docs/AUDIT_SLASH_MODEL.md`). Pure
 * read-only, client-side: data comes from `@aastar/sdk` typed views via
 * `lib/sdk/credibility`, no wallet/signing required.
 */
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatUnits } from "viem";
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import Layout from "@/components/Layout";
import { listCommunityCredibility, type CommunityCredibility } from "@/lib/sdk/credibility";

/** USD fields are 18-decimal fixed point (USD × 1e18) — format, don't treat as wei. */
function formatUsd(value: bigint): string {
  const whole = formatUnits(value, 18);
  const n = Number(whole);
  if (!Number.isFinite(n)) return whole;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Score → semantic color band (score is a backing-coverage %). */
function scoreBand(score: number): { bar: string; text: string } {
  if (score >= 80) return { bar: "bg-green-500", text: "text-green-700 dark:text-green-400" };
  if (score >= 50) return { bar: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" };
  return { bar: "bg-red-500", text: "text-red-700 dark:text-red-400" };
}

function shortenAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function CredibilityRow({ entry }: { entry: CommunityCredibility }) {
  const { t } = useTranslation();
  const { credibility: c } = entry;
  const score = Math.max(0, Math.min(100, c.credibilityScore));
  const band = scoreBand(score);

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 dark:text-white truncate">{entry.name}</span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{entry.symbol}</span>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
            {shortenAddr(entry.token)}
          </div>
        </div>
        {c.isOverIssued && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-300 shrink-0">
            <ExclamationTriangleIcon className="h-3.5 w-3.5" />
            {t("credibilityPage.overIssuedBadge")}
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {t("credibilityPage.scoreLabel")}
          </span>
          <span className={`text-sm font-bold ${band.text}`}>{score}/100</span>
        </div>
        <div className="mt-1 h-2 w-full rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
          <div className={`h-full ${band.bar}`} style={{ width: `${score}%` }} />
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div>
          <dt className="text-[11px] text-gray-400 dark:text-gray-500">{t("credibilityPage.backing")}</dt>
          <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">${formatUsd(c.backingValueUSD)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-gray-400 dark:text-gray-500">{t("credibilityPage.issued")}</dt>
          <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">${formatUsd(c.issuedValueUSD)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-gray-400 dark:text-gray-500">{t("credibilityPage.cap")}</dt>
          <dd className="text-sm font-medium text-gray-900 dark:text-gray-100">${formatUsd(c.effectiveCapUSD)}</dd>
        </div>
      </dl>

      {c.isOverIssued && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">
          {t("credibilityPage.overIssuedHint")}
        </p>
      )}
    </div>
  );
}

function RulesDisclosure() {
  const { t } = useTranslation();
  const penalties = t("credibilityPage.rules.penalties", { returnObjects: true }) as Array<{
    name: string;
    desc: string;
  }>;
  const ruleList = t("credibilityPage.rules.ruleList", { returnObjects: true }) as string[];

  return (
    <section className="mt-8 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
        <ShieldCheckIcon className="h-4 w-4 text-gray-500" />
        {t("credibilityPage.rules.title")}
      </h2>
      <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">{t("credibilityPage.rules.intro")}</p>

      <div className="mt-3 space-y-2">
        {Array.isArray(penalties) &&
          penalties.map((p) => (
            <div key={p.name} className="text-xs">
              <span className="font-semibold text-gray-800 dark:text-gray-200">{p.name}</span>
              <span className="text-gray-600 dark:text-gray-400"> — {p.desc}</span>
            </div>
          ))}
      </div>

      <p className="mt-4 text-xs font-medium text-gray-700 dark:text-gray-300">
        {t("credibilityPage.rules.formulaTitle")}
      </p>
      <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{t("credibilityPage.rules.formula")}</p>

      {Array.isArray(ruleList) && ruleList.length > 0 && (
        <ul className="mt-3 list-disc pl-5 space-y-1 text-xs text-gray-600 dark:text-gray-400">
          {ruleList.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}

      <p className="mt-4 text-[11px] text-gray-400 dark:text-gray-500">{t("credibilityPage.rules.source")}</p>
    </section>
  );
}

export default function CredibilityPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<CommunityCredibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listCommunityCredibility();
      setEntries(rows.filter((r): r is CommunityCredibility => r !== null));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Layout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{t("credibilityPage.title")}</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("credibilityPage.subtitle")}</p>
          </div>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {t("credibilityPage.refresh")}
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {loading && (
            <div className="text-center text-sm text-gray-400 py-10">{t("credibilityPage.loading")}</div>
          )}
          {!loading && error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-300">
              {t("credibilityPage.error")}: {error}
            </div>
          )}
          {!loading && !error && entries.length === 0 && (
            <div className="text-center text-sm text-gray-400 py-10">{t("credibilityPage.empty")}</div>
          )}
          {!loading &&
            !error &&
            entries.map((entry) => <CredibilityRow key={entry.token} entry={entry} />)}
        </div>

        <RulesDisclosure />
      </div>
    </Layout>
  );
}
