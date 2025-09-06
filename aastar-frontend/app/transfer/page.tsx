"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { accountAPI, transferAPI } from "@/lib/api";
import { Account, GasEstimate } from "@/lib/types";
import toast from "react-hot-toast";
import {
  ArrowUpIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

export default function TransferPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState({
    to: "",
    amount: "",
  });
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null);
  const [loading, setLoading] = useState({
    page: true,
    estimate: false,
    transfer: false,
    sponsor: false,
  });
  const [transferResult, setTransferResult] = useState<any>(null);
  const [transferStatus, setTransferStatus] = useState<any>(null);
  const [showDeploymentBanner, setShowDeploymentBanner] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    loadPageData();
  }, []);

  const loadPageData = async () => {
    setLoading(prev => ({ ...prev, page: true }));
    try {
      // Load account
      const accountResponse = await accountAPI.getAccount();
      setAccount(accountResponse.data);

      // Show deployment banner if account is not deployed
      if (!accountResponse.data.deployed) {
        setShowDeploymentBanner(true);
      }
    } catch (error: any) {
      console.error("Transfer page error:", error);
      const message = error.response?.data?.message || "Failed to load account data";
      console.error("Error message:", message);
      console.error("Error status:", error.response?.status);
      toast.error(message);
      router.push("/dashboard");
    } finally {
      setLoading(prev => ({ ...prev, page: false }));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Clear gas estimate when form changes
    if (gasEstimate) {
      setGasEstimate(null);
    }
  };

  const estimateGas = async () => {
    if (!formData.to || !formData.amount) {
      toast.error("Please fill in recipient address and amount");
      return;
    }

    setLoading(prev => ({ ...prev, estimate: true }));
    try {
      const response = await transferAPI.estimate({
        to: formData.to,
        amount: formData.amount,
      });
      setGasEstimate(response.data);
      toast.success("Gas estimated successfully");
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to estimate gas";
      toast.error(message);
    } finally {
      setLoading(prev => ({ ...prev, estimate: false }));
    }
  };

  const executeTransfer = async () => {
    if (!formData.to || !formData.amount) {
      toast.error("Please fill in recipient address and amount");
      return;
    }

    // Check if amount exceeds available balance
    const transferAmount = parseFloat(formData.amount);
    const availableBalance = parseFloat(account?.balance || "0");
    if (transferAmount > availableBalance) {
      toast.error(
        `Insufficient balance: Trying to send ${transferAmount} ETH but only ${availableBalance} ETH available`
      );
      return;
    }

    // Stop any existing polling and clear previous results
    stopPolling();
    setTransferResult(null);
    setTransferStatus(null);

    setLoading(prev => ({ ...prev, transfer: true }));
    try {
      const response = await transferAPI.execute({
        to: formData.to,
        amount: formData.amount,
      });

      setTransferResult(response.data);
      toast.success("Transfer submitted! Tracking status...");

      // Start polling for status
      startStatusPolling(response.data.transferId);

      // Clear form
      setFormData({
        to: "",
        amount: "",
      });
      setGasEstimate(null);
    } catch (error: any) {
      const message = error.response?.data?.message || "Transfer failed";
      toast.error(message);
    } finally {
      setLoading(prev => ({ ...prev, transfer: false }));
    }
  };

  const startStatusPolling = (transferId: string) => {
    // Clear any existing polling
    stopPolling();

    // Set polling flag
    isPollingRef.current = true;

    // Poll immediately
    checkTransferStatus(transferId);

    // Set up polling interval (every 2 seconds)
    const interval = setInterval(() => {
      if (!isPollingRef.current) {
        clearInterval(interval);
        return;
      }
      checkTransferStatus(transferId);
    }, 2000);

    pollingIntervalRef.current = interval;
  };

  const stopPolling = () => {
    isPollingRef.current = false;
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const checkTransferStatus = async (transferId: string) => {
    // Skip if not polling
    if (!isPollingRef.current) {
      return;
    }

    try {
      const response = await transferAPI.getStatus(transferId);
      setTransferStatus(response.data);

      // Stop polling if transfer is completed or failed
      if (response.data.status === "completed" || response.data.status === "failed") {
        const wasPolling = isPollingRef.current;
        stopPolling();

        // Only show toast once when polling was active
        if (wasPolling) {
          if (response.data.status === "completed") {
            toast.success("Transfer completed successfully!");
          } else {
            toast.error(`Transfer failed: ${response.data.error || "Unknown error"}`);
          }
        }
      }
    } catch (error) {
      console.error("Failed to check transfer status:", error);
    }
  };

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  const formatGwei = (wei: string) => {
    return (parseInt(wei, 16) / 1e9).toFixed(2);
  };

  // Format balance to avoid display issues with too many decimals
  const formatBalance = (balance: string | undefined) => {
    if (!balance) return "0";
    const num = parseFloat(balance);
    if (num === 0) return "0";
    if (num >= 1) return num.toFixed(4);
    if (num >= 0.0001) return num.toFixed(6);
    return num.toFixed(8);
  };

  // Check if transfer should be disabled
  const isTransferDisabled = () => {
    if (!formData.to || !formData.amount || loading.transfer) {
      return true;
    }

    const transferAmount = parseFloat(formData.amount);
    const availableBalance = parseFloat(account?.balance || "0");

    return transferAmount > availableBalance || transferAmount <= 0;
  };

  // Refresh account balance
  const refreshBalance = async () => {
    try {
      const accountResponse = await accountAPI.getAccount();
      setAccount(accountResponse.data);
      toast.success("Balance updated");
    } catch (error) {
      toast.error("Failed to refresh balance");
    }
  };

  // Sponsor account with 0.01 ETH
  const sponsorAccount = async () => {
    setLoading(prev => ({ ...prev, sponsor: true }));
    try {
      await accountAPI.sponsorAccount();
      toast.success("Account sponsored successfully! 🎉");
      
      // Refresh account data to update sponsored status and balance
      await refreshBalance();
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to sponsor account";
      toast.error(message);
    } finally {
      setLoading(prev => ({ ...prev, sponsor: false }));
    }
  };

  // Check if sponsor button should be shown
  const shouldShowSponsorButton = () => {
    if (!account) return false;
    if (account.sponsored) return false;
    
    const balance = parseFloat(account.balance || "0");
    return balance <= 0.01;
  };

  if (loading.page) {
    return (
      <Layout requireAuth={true}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requireAuth={true}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center">
            <ArrowUpIcon className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Send Transfer</h1>
              <p className="text-sm text-gray-600">Send ETH using ERC-4337 account abstraction - gas fees handled automatically</p>
            </div>
          </div>
        </div>

        {/* Deployment Banner */}
        {showDeploymentBanner && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <InformationCircleIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm text-blue-700">
                  <strong>First Transfer:</strong> Your smart account will be automatically deployed
                  with your first transfer - no additional gas fees required!
                </p>
              </div>
              <div className="ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    type="button"
                    onClick={() => setShowDeploymentBanner(false)}
                    className="inline-flex bg-blue-50 rounded-md p-1.5 text-blue-500 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-50 focus:ring-blue-600"
                  >
                    <span className="sr-only">Dismiss</span>
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Account Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-blue-900">Account Balance</p>
              <div className="relative group">
                <div className="text-lg font-semibold text-blue-900">
                  {formatBalance(account?.balance)} ETH
                </div>
                {/* Tooltip */}
                <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-10">
                  <div className="font-mono">{account?.balance || "0"} ETH</div>
                  <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-700">Account Address</p>
              <p className="text-sm font-mono text-blue-900">
                {account?.address.slice(0, 10)}...{account?.address.slice(-8)}
              </p>
              <div className="mt-2 flex justify-end space-x-2">
                <button
                  onClick={refreshBalance}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-white border border-blue-200 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </button>
                {shouldShowSponsorButton() && (
                  <button
                    onClick={sponsorAccount}
                    disabled={loading.sponsor}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-600 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading.sponsor ? (
                      <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600 mr-1"></div>
                    ) : (
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                        />
                      </svg>
                    )}
                    Sponsor
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Transfer Status */}
        {transferResult && (
          <div
            className={`border rounded-lg p-4 mb-6 ${
              transferStatus?.status === "completed"
                ? "bg-green-50 border-green-200"
                : transferStatus?.status === "failed"
                  ? "bg-red-50 border-red-200"
                  : "bg-blue-50 border-blue-200"
            }`}
          >
            <div className="flex">
              {transferStatus?.status === "completed" ? (
                <CheckCircleIcon className="h-5 w-5 text-green-400" />
              ) : transferStatus?.status === "failed" ? (
                <InformationCircleIcon className="h-5 w-5 text-red-400" />
              ) : (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
              )}
              <div className="ml-3 flex-1">
                <h3
                  className={`text-sm font-medium ${
                    transferStatus?.status === "completed"
                      ? "text-green-800"
                      : transferStatus?.status === "failed"
                        ? "text-red-800"
                        : "text-blue-800"
                  }`}
                >
                  {transferStatus?.statusDescription || "Transfer Submitted"}
                </h3>
                <div className="mt-2 text-sm space-y-1">
                  <p className="text-gray-600">
                    Status:{" "}
                    <span className="font-medium">
                      {transferStatus?.status || transferResult.status}
                    </span>
                    {transferStatus?.elapsedSeconds && (
                      <span className="ml-2 text-gray-500">
                        ({transferStatus.elapsedSeconds}s elapsed)
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-xs text-gray-500">
                    Transfer ID: {transferResult.transferId}
                  </p>
                  {transferStatus?.transactionHash && (
                    <p className="font-mono text-xs text-gray-600">
                      Transaction:
                      <a
                        href={transferStatus.explorerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-blue-600 hover:text-blue-800 underline"
                      >
                        {transferStatus.transactionHash.slice(0, 20)}...
                      </a>
                    </p>
                  )}
                  {transferStatus?.bundlerUserOpHash && !transferStatus?.transactionHash && (
                    <p className="text-xs text-gray-500">Bundler processing transaction...</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Transfer Form */}
        <div className="bg-white shadow-sm rounded-lg">
          <div className="p-6 space-y-6">
            {/* Recipient */}
            <div>
              <label htmlFor="to" className="block text-sm font-medium text-gray-700">
                Recipient Address
              </label>
              <input
                type="text"
                name="to"
                id="to"
                value={formData.to}
                onChange={handleChange}
                placeholder="0x..."
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                Amount (ETH)
              </label>
              <input
                type="number"
                name="amount"
                id="amount"
                step="0.001"
                min="0"
                value={formData.amount}
                onChange={handleChange}
                placeholder="0.001"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <div className="mt-1 text-sm text-gray-500">
                Available:
                <span className="relative group ml-1">
                  {formatBalance(account?.balance)} ETH
                  {/* Tooltip for available balance */}
                  <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-20">
                    <div className="font-mono">Exact: {account?.balance || "0"} ETH</div>
                    <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                  </div>
                </span>
                {formData.amount &&
                  parseFloat(formData.amount) > parseFloat(account?.balance || "0") && (
                    <span className="text-red-600 ml-2">⚠️ Insufficient balance</span>
                  )}
              </div>
            </div>

            {/* Gas Estimation */}
            {gasEstimate && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-2">Gas Estimation</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Call Gas:</span>
                    <span className="ml-2 font-mono">
                      {parseInt(gasEstimate.callGasLimit, 16).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Verification Gas:</span>
                    <span className="ml-2 font-mono">
                      {parseInt(gasEstimate.verificationGasLimit, 16).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Pre-verification:</span>
                    <span className="ml-2 font-mono">
                      {parseInt(gasEstimate.preVerificationGas, 16).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Max Fee:</span>
                    <span className="ml-2 font-mono">
                      {formatGwei(gasEstimate.maxFeePerGas)} Gwei
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                type="button"
                onClick={estimateGas}
                disabled={loading.estimate || !formData.to || !formData.amount}
                className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading.estimate ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
                ) : null}
                Estimate Gas
              </button>

              <button
                type="button"
                onClick={executeTransfer}
                disabled={isTransferDisabled()}
                className={`flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  isTransferDisabled()
                    ? "bg-gray-400 text-gray-100 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {loading.transfer ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <ArrowUpIcon className="h-4 w-4 mr-2" />
                )}
                {formData.amount &&
                parseFloat(formData.amount) > parseFloat(account?.balance || "0")
                  ? "Insufficient Balance"
                  : "Send Transfer"}
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <div className="flex">
            <InformationCircleIcon className="h-5 w-5 text-blue-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">How it works</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Gas fees are automatically handled - no need to hold ETH for gas</li>
                  <li>BLS nodes are automatically selected from the gossip network</li>
                  <li>Transaction uses ERC-4337 UserOperation</li>
                  <li>BLS signatures reduce verification costs</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
