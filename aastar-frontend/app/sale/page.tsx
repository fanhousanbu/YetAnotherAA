"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CurrencyDollarIcon,
  ArrowPathIcon,
  CheckBadgeIcon,
  XCircleIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";
import Layout from "@/components/Layout";
import { saleAPI } from "@/lib/api";

interface GTokenSaleStatus {
  configured: boolean;
  address: string | null;
  currentPriceUSD: string;
  ceilingPriceUSD: string;
  tokensSold: string;
  totalForSale: string;
  soldPercent: number;
  currentStage: number;
  saleEnded: boolean;
  stage1Limit: string;
  stage2Limit: string;
}

interface APNTsSaleStatus {
  configured: boolean;
  address: string | null;
  priceUSD: string;
  totalSold: string;
  availableInventory: string;
  minPurchaseAmount: string;
  maxPurchaseAmount: string;
  saleActive: boolean;
}

interface GTokenEligibility {
  address: string;
  eligible: boolean;
  hasBought: boolean;
  reason: string | null;
}

function ProgressBar({ percent }: { percent: number }) {
  const stage1Pct = 20; // 210k / 1050k
  const stage2Pct = 60; // 630k / 1050k

  return (
    <div className="relative w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
        style={{ width: `${Math.min(percent, 100)}%` }}
      />
      {/* Stage markers */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/50"
        style={{ left: `${stage1Pct}%` }}
      />
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white/50"
        style={{ left: `${stage2Pct}%` }}
      />
    </div>
  );
}

export default function SalePage() {
  const router = useRouter();
  const [gTokenStatus, setGTokenStatus] = useState<GTokenSaleStatus | null>(null);
  const [aPNTsStatus, setAPNTsStatus] = useState<APNTsSaleStatus | null>(null);
  const [eligibility, setEligibility] = useState<GTokenEligibility | null>(null);
  const [apntsQuote, setApntsQuote] = useState<{ usdIn: string; aPNTsOut: string } | null>(null);
  const [quoteUSD, setQuoteUSD] = useState("100");
  const [loading, setLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      saleAPI.getGTokenStatus().then(r => setGTokenStatus(r.data)),
      saleAPI.getAPNTsStatus().then(r => setAPNTsStatus(r.data)),
      saleAPI.getGTokenEligibility().then(r => setEligibility(r.data)).catch(() => null),
    ])
      .catch(err => {
        if (err.response?.status === 401) router.push("/auth/login");
        else setError("Failed to load sale data");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const fetchQuote = async () => {
    if (!quoteUSD || parseFloat(quoteUSD) <= 0) return;
    setQuoteLoading(true);
    try {
      const r = await saleAPI.getAPNTsQuote(quoteUSD);
      setApntsQuote(r.data);
    } catch {
      setError("Failed to get quote");
    } finally {
      setQuoteLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout requireAuth>
        <div className="flex items-center justify-center min-h-[60vh]">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-slate-600 dark:text-emerald-400" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout requireAuth>
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
        <CurrencyDollarIcon className="h-7 w-7 text-slate-700 dark:text-emerald-400" />
        Token Sale
      </h1>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* GToken Sale */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <ArrowTrendingUpIcon className="h-5 w-5 text-indigo-400" />
            GToken Sale
          </h2>
          {gTokenStatus?.configured ? (
            gTokenStatus.saleEnded ? (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-full text-xs">
                Sale Ended
              </span>
            ) : (
              <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded-full text-xs font-medium">
                Stage {gTokenStatus.currentStage} Active
              </span>
            )
          ) : (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-full text-xs">
              Not Configured
            </span>
          )}
        </div>

        {gTokenStatus?.configured ? (
          <>
            {/* Price Info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Current Price</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${parseFloat(gTokenStatus.currentPriceUSD).toFixed(4)}
                </p>
                <p className="text-xs text-gray-400">per GToken</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Tokens Sold</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {parseFloat(gTokenStatus.tokensSold).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="text-xs text-gray-400">
                  of{" "}
                  {parseFloat(gTokenStatus.totalForSale).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Ceiling Price</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  ${parseFloat(gTokenStatus.ceilingPriceUSD).toFixed(4)}
                </p>
                <p className="text-xs text-gray-400">max price</p>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>Stage 1 (S1)</span>
                <span>Stage 2</span>
                <span>Stage 3</span>
              </div>
              <ProgressBar percent={gTokenStatus.soldPercent} />
              <p className="text-right text-xs text-gray-400 mt-1">
                {gTokenStatus.soldPercent.toFixed(1)}% sold
              </p>
            </div>

            {/* Eligibility */}
            {eligibility && (
              <div
                className={`rounded-xl p-4 border ${
                  eligibility.eligible
                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                    : "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-center gap-2">
                  {eligibility.eligible ? (
                    <CheckBadgeIcon className="h-5 w-5 text-green-600" />
                  ) : (
                    <XCircleIcon className="h-5 w-5 text-gray-400" />
                  )}
                  <p
                    className={`text-sm font-medium ${
                      eligibility.eligible
                        ? "text-green-800 dark:text-green-300"
                        : "text-gray-600 dark:text-gray-300"
                    }`}
                  >
                    {eligibility.eligible ? "You are eligible to buy GTokens" : eligibility.reason}
                  </p>
                </div>
                {eligibility.eligible && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Connect your wallet and call{" "}
                    <code className="bg-green-100 dark:bg-green-800 px-1 rounded">
                      buyTokens(usdAmount, paymentToken, signature)
                    </code>{" "}
                    on the sale contract.
                  </p>
                )}
              </div>
            )}

            <p className="mt-2 text-xs font-mono text-gray-400">
              Contract: {gTokenStatus.address}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500">
            GToken sale contract not configured. Set <code>GTOKEN_SALE_ADDRESS</code> in env.
          </p>
        )}
      </section>

      {/* aPNTs Sale */}
      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <CurrencyDollarIcon className="h-5 w-5 text-purple-400" />
            aPNTs Sale
          </h2>
          {aPNTsStatus?.configured ? (
            aPNTsStatus.saleActive ? (
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                Active
              </span>
            ) : (
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-full text-xs">
                No Inventory
              </span>
            )
          ) : (
            <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-full text-xs">
              Not Configured
            </span>
          )}
        </div>

        {aPNTsStatus?.configured ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Price</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${parseFloat(aPNTsStatus.priceUSD).toFixed(4)}
                </p>
                <p className="text-xs text-gray-400">per aPNTs (fixed)</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Available</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {parseFloat(aPNTsStatus.availableInventory).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="text-xs text-gray-400">aPNTs</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">Limits</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {parseFloat(aPNTsStatus.minPurchaseAmount).toFixed(0)} –{" "}
                  {parseFloat(aPNTsStatus.maxPurchaseAmount).toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="text-xs text-gray-400">aPNTs per purchase</p>
              </div>
            </div>

            {/* Quote calculator */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Price Calculator
              </p>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    value={quoteUSD}
                    onChange={e => setQuoteUSD(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && fetchQuote()}
                    placeholder="100"
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={fetchQuote}
                  disabled={quoteLoading}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-sm rounded-lg disabled:opacity-50"
                >
                  {quoteLoading ? "…" : "Quote"}
                </button>
              </div>
              {apntsQuote && (
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="text-gray-500">${apntsQuote.usdIn} USDC</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-bold text-purple-700 dark:text-purple-300">
                    {parseFloat(apntsQuote.aPNTsOut).toLocaleString()} aPNTs
                  </span>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs font-mono text-gray-400">
              Contract: {aPNTsStatus.address}
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-500">
            aPNTs sale contract not configured. Set <code>APNTS_SALE_ADDRESS</code> in env.
          </p>
        )}
      </section>
    </div>
    </Layout>
  );
}
