"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "react-qr-code";
import CopyButton from "@/components/CopyButton";
import { useDashboard } from "@/contexts/DashboardContext";
import { ArrowLeftIcon, QrCodeIcon } from "@heroicons/react/24/outline";
import toast from "react-hot-toast";

export default function ReceivePage() {
  const router = useRouter();
  const { data } = useDashboard();
  const { account } = data;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if it's mobile view
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);

      // If not mobile, redirect to dashboard
      if (!mobile) {
        router.push("/dashboard");
        toast("Please use the Receive button on desktop", {
          icon: "ℹ️",
        });
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, [router]);

  // If no account, redirect to dashboard
  useEffect(() => {
    if (!account?.address) {
      router.push("/dashboard");
    }
  }, [account, router]);

  if (!account?.address) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 md:hidden">
      {/* Mobile Header with Back Button */}
      <div className="sticky top-0 z-50 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center px-4 h-14">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors touch-manipulation active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>
          <h1 className="flex-1 text-lg font-semibold text-center text-gray-900 dark:text-white pr-8">
            Receive Funds
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-20 max-w-md mx-auto">
        {/* QR Code Section */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6 mb-4">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-white rounded-xl shadow-inner border-2 border-gray-200 dark:border-gray-600">
              <QRCode
                value={account.address}
                size={220}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
          </div>

          {/* Instructions */}
          <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
              Scan this QR code or copy the address below to receive ETH and tokens
            </p>
          </div>

          {/* Address Display */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Your Smart Account Address:
            </label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                  {account.address}
                </p>
              </div>
            </div>
            <div className="flex justify-center mt-3">
              <CopyButton
                text={account.address}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all touch-manipulation active:scale-95"
                showToast={true}
                buttonStyle="custom"
              />
            </div>
          </div>
        </div>

        {/* Info Note */}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-start">
            <QrCodeIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 mr-2 flex-shrink-0" />
            <div className="text-sm text-emerald-700 dark:text-emerald-400">
              <p className="font-medium mb-1">ERC-4337 Smart Account</p>
              <p className="text-xs">
                You can receive ETH and any ERC-20 tokens directly to this address. Your smart
                account is fully compatible with all Ethereum assets.
              </p>
            </div>
          </div>
        </div>

        {/* Additional Actions */}
        <div className="mt-6 space-y-3">
          <button
            onClick={() => {
              if (navigator.share) {
                navigator
                  .share({
                    title: "My Smart Account Address",
                    text: account.address,
                  })
                  .catch(() => {
                    // User cancelled or share failed
                  });
              } else {
                navigator.clipboard.writeText(account.address);
                toast.success("Address copied to clipboard!");
              }
            }}
            className="w-full px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-all touch-manipulation active:scale-95"
          >
            Share Address
          </button>
        </div>
      </div>
    </div>
  );
}
