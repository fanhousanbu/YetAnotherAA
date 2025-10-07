"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import CopyButton from "@/components/CopyButton";
import { transferAPI } from "@/lib/api";
import { TokenTransfer } from "@/lib/types";
import toast from "react-hot-toast";
import {
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

export default function TransferHistoryPage() {
  const [transfers, setTransfers] = useState<TokenTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pullStartY, setPullStartY] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const router = useRouter();

  useEffect(() => {
    loadTransfers();
  }, [pagination.page]);

  // Pull to refresh handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY === 0) {
      setPullStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY > 0 && window.scrollY === 0) {
      const currentY = e.touches[0].clientY;
      const distance = currentY - pullStartY;
      if (distance > 0) {
        setPullDistance(distance);
      }
    }
  };

  const handleTouchEnd = () => {
    if (pullDistance > 80 && !refreshing) {
      loadTransfers(false, true);
    }
    setPullStartY(0);
    setPullDistance(0);
  };

  const loadTransfers = async (showToast: boolean = false, isRefreshing: boolean = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await transferAPI.getHistory(pagination.page, pagination.limit);
      setTransfers(response.data.transfers);
      setPagination(prev => ({
        ...prev,
        total: response.data.total,
        totalPages: response.data.totalPages,
      }));
      if (showToast) {
        toast.success("Transfers refreshed");
      }
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to load transfers";
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case "failed":
        return <ExclamationCircleIcon className="h-5 w-5 text-red-500" />;
      case "pending":
      case "submitted":
        return <ClockIcon className="h-5 w-5 text-yellow-500" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300";
      case "failed":
        return "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
      case "pending":
      case "submitted":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300";
    }
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  if (loading && transfers.length === 0) {
    return (
      <Layout requireAuth={true}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-slate-900 dark:border-emerald-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requireAuth={true}>
      <div
        className="min-h-screen bg-slate-100 dark:bg-slate-950"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Mobile Header with Back Button */}
        <div className="md:hidden sticky top-0 bg-slate-100 dark:bg-slate-950 z-30 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-gray-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-emerald-400"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <div className="flex items-center gap-2 flex-1">
              <ClockIcon className="w-6 h-6 text-slate-900 dark:text-emerald-400 flex-shrink-0" />
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">Transfer History</h1>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header - Desktop only */}
          <div className="hidden md:block mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Transfer History
                </h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  View all your ERC-4337 transfers
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => loadTransfers(true)}
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:focus:ring-emerald-400 dark:focus:ring-offset-gray-800 disabled:opacity-50 transition-all"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-900 dark:border-emerald-500 mr-2"></div>
                  ) : (
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </button>
                <button
                  onClick={() => router.push("/transfer")}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
                >
                  New Transfer
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Pull-to-Refresh Indicator */}
          {refreshing && (
            <div className="md:hidden mb-4 flex items-center justify-center py-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-slate-900 dark:border-emerald-500"></div>
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Refreshing...</span>
            </div>
          )}

          {/* Pull indicator when pulling */}
          {pullDistance > 0 && pullDistance < 80 && (
            <div className="md:hidden mb-4 flex items-center justify-center py-2 text-sm text-gray-500 dark:text-gray-400">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
              Pull down to refresh
            </div>
          )}

          {pullDistance >= 80 && (
            <div className="md:hidden mb-4 flex items-center justify-center py-2 text-sm text-emerald-600 dark:text-emerald-400">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Release to refresh
            </div>
          )}

          {/* Transfer List */}
          <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {transfers.length > 0 ? (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Recipient
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Transaction
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                          Nodes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {transfers.map(transfer => (
                        <tr key={transfer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              {getStatusIcon(transfer.status)}
                              <span
                                className={`ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(transfer.status)}`}
                              >
                                {transfer.status}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <CopyButton text={transfer.to} className="text-sm" />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {transfer.amount} {transfer.tokenSymbol || "ETH"}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {new Date(transfer.createdAt).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {new Date(transfer.createdAt).toLocaleTimeString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {transfer.transactionHash ? (
                              <CopyButton text={transfer.transactionHash} className="text-sm" />
                            ) : (
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Pending...
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900 dark:text-white">
                              {transfer.nodeIndices.join(", ")}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-gray-200 dark:divide-gray-700">
                  {transfers.map(transfer => (
                    <div
                      key={transfer.id}
                      className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      {/* Status and Amount */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(transfer.status)}
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(transfer.status)}`}
                          >
                            {transfer.status}
                          </span>
                        </div>
                        <div className="text-base font-semibold text-gray-900 dark:text-white">
                          {transfer.amount} {transfer.tokenSymbol || "ETH"}
                        </div>
                      </div>

                      {/* Recipient */}
                      <div className="mb-2">
                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Recipient
                        </div>
                        <CopyButton text={transfer.to} className="text-sm" />
                      </div>

                      {/* Transaction Hash */}
                      {transfer.transactionHash && (
                        <div className="mb-2">
                          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                            Transaction
                          </div>
                          <CopyButton text={transfer.transactionHash} className="text-sm" />
                        </div>
                      )}

                      {/* Date and Nodes */}
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div>
                          {new Date(transfer.createdAt).toLocaleDateString()}{" "}
                          {new Date(transfer.createdAt).toLocaleTimeString()}
                        </div>
                        <div>Nodes: {transfer.nodeIndices.join(", ")}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {pagination.totalPages > 1 && (
                  <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages}
                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                      >
                        Next
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          Showing{" "}
                          <span className="font-medium">
                            {Math.min(
                              (pagination.page - 1) * pagination.limit + 1,
                              pagination.total
                            )}
                          </span>{" "}
                          to{" "}
                          <span className="font-medium">
                            {Math.min(pagination.page * pagination.limit, pagination.total)}
                          </span>{" "}
                          of <span className="font-medium">{pagination.total}</span> results
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-xl shadow-sm -space-x-px">
                          <button
                            onClick={() => handlePageChange(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            Previous
                          </button>

                          {/* Page numbers */}
                          {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                            const pageNum = i + 1;
                            return (
                              <button
                                key={pageNum}
                                onClick={() => handlePageChange(pageNum)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-all ${
                                  pagination.page === pageNum
                                    ? "z-10 bg-slate-50 dark:bg-slate-800/50 border-slate-500 dark:border-slate-400 text-slate-900 dark:text-emerald-400"
                                    : "bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}

                          <button
                            onClick={() => handlePageChange(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                          >
                            Next
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <ClockIcon className="mx-auto h-12 w-12 text-gray-500 dark:text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  No transfers yet
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Get started by making your first transfer.
                </p>
                <div className="mt-6">
                  <button
                    onClick={() => router.push("/transfer")}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium rounded-xl text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:focus:ring-emerald-500"
                  >
                    Send Transfer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
