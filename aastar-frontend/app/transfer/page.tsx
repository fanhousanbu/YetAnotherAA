"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import TokenSelector from "@/components/TokenSelector";
import { accountAPI, transferAPI, tokenAPI } from "@/lib/api";
import { Account, GasEstimate, Token, TokenBalance } from "@/lib/types";
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
    usePaymaster: false,
  });
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [tokenBalance, setTokenBalance] = useState<TokenBalance | null>(null);
  const [loadingTokenBalance, setLoadingTokenBalance] = useState(false);
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

  const loadTokenBalance = async (token: Token | null) => {
    if (!token || token.address === "ETH") {
      setTokenBalance(null);
      return;
    }

    setLoadingTokenBalance(true);
    try {
      const response = await tokenAPI.getTokenBalance(token.address);
      setTokenBalance(response.data);
    } catch (error) {
      console.error("Failed to load token balance:", error);
      setTokenBalance(null);
    } finally {
      setLoadingTokenBalance(false);
    }
  };

  // Load token balance when selected token changes
  useEffect(() => {
    loadTokenBalance(selectedToken);
  }, [selectedToken]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
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
        tokenAddress: selectedToken?.address === "ETH" ? undefined : selectedToken?.address,
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

    if (!selectedToken || selectedToken.address === "ETH") {
      // ETH transfer validation
      const availableBalance = parseFloat(account?.balance || "0");
      if (transferAmount > availableBalance) {
        toast.error(
          `Insufficient balance: Trying to send ${transferAmount} ETH but only ${availableBalance} ETH available`
        );
        return;
      }
    } else {
      // Token transfer validation - for now just check if token is selected
      // Token balance validation will be implemented with the TokenSelector
      if (!selectedToken) {
        toast.error("Please select a token to transfer");
        return;
      }
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
        usePaymaster: formData.usePaymaster,
        tokenAddress: selectedToken?.address === "ETH" ? undefined : selectedToken?.address,
      });

      setTransferResult(response.data);
      toast.success("Transfer submitted! Tracking status...");

      // Start polling for status
      startStatusPolling(response.data.transferId);

      // Clear form
      setFormData({
        to: "",
        amount: "",
        usePaymaster: false,
      });
      setSelectedToken(null);
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
    if (transferAmount <= 0) return true;

    // For ETH transfers, check ETH balance
    if (!selectedToken || selectedToken.address === "ETH") {
      const availableBalance = parseFloat(account?.balance || "0");
      return transferAmount > availableBalance;
    }

    // For token transfers, we'll rely on the TokenSelector balance display for now
    return false;
  };

  // Refresh account balance
  const refreshBalance = async () => {
    try {
      const accountResponse = await accountAPI.getAccount();
      setAccount(accountResponse.data);
      toast.success("Balance updated");
    } catch {
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
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-32 h-32 border-b-2 border-blue-500 rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requireAuth={true}>
      <div className="max-w-2xl px-4 py-6 mx-auto sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center">
            <ArrowUpIcon className="w-8 h-8 mr-3 text-blue-500" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Send Transfer</h1>
              <p className="text-sm text-gray-600">
                Send ETH using ERC-4337 account abstraction - gas fees handled automatically
              </p>
            </div>
          </div>
        </div>

        {/* Deployment Banner */}
        {showDeploymentBanner && (
          <div className="p-4 mb-6 border-l-4 border-blue-400 bg-blue-50">
            <div className="flex">
              <div className="flex-shrink-0">
                <InformationCircleIcon className="w-5 h-5 text-blue-400" />
              </div>
              <div className="flex-1 ml-3">
                <p className="text-sm text-blue-700">
                  <strong>First Transfer:</strong> Your smart account will be automatically deployed
                  with your first transfer - no additional gas fees required!
                </p>
              </div>
              <div className="pl-3 ml-auto">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    type="button"
                    onClick={() => setShowDeploymentBanner(false)}
                    className="inline-flex bg-blue-50 rounded-md p-1.5 text-blue-500 hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-50 focus:ring-blue-600"
                  >
                    <span className="sr-only">Dismiss</span>
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Account Info */}
        <div className="p-4 mb-6 border border-blue-200 rounded-lg bg-blue-50">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-blue-900">Account Balance</p>
              <div className="relative group">
                <div className="text-lg font-semibold text-blue-900">
                  {formatBalance(account?.balance)} ETH
                </div>
                {/* Tooltip */}
                <div className="absolute left-0 z-10 invisible px-3 py-2 mb-2 text-sm text-white transition-all duration-200 bg-gray-900 rounded-lg opacity-0 bottom-full group-hover:opacity-100 group-hover:visible whitespace-nowrap">
                  <div className="font-mono">{account?.balance || "0"} ETH</div>
                  <div className="absolute w-0 h-0 border-t-4 border-l-4 border-r-4 top-full left-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-700">Account Address</p>
              <p className="font-mono text-sm text-blue-900">
                {account?.address.slice(0, 10)}...{account?.address.slice(-8)}
              </p>
              <div className="flex justify-end mt-2 space-x-2">
                <button
                  onClick={refreshBalance}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-600 bg-white border border-blue-200 rounded-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <svg
                    className="w-3 h-3 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
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
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-600 border border-green-200 rounded-md bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading.sponsor ? (
                      <div className="w-3 h-3 mr-1 border-b-2 border-green-600 rounded-full animate-spin"></div>
                    ) : (
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
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
                <CheckCircleIcon className="w-5 h-5 text-green-400" />
              ) : transferStatus?.status === "failed" ? (
                <InformationCircleIcon className="w-5 h-5 text-red-400" />
              ) : (
                <div className="w-5 h-5 border-b-2 border-blue-500 rounded-full animate-spin"></div>
              )}
              <div className="flex-1 ml-3">
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
                <div className="mt-2 space-y-1 text-sm">
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
                        className="ml-1 text-blue-600 underline hover:text-blue-800"
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
        <div className="bg-white rounded-lg shadow-sm">
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
                className="block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>

            {/* Token Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Token</label>
              <TokenSelector
                selectedToken={selectedToken}
                onTokenChange={setSelectedToken}
                accountAddress={account?.address}
                showBalances={true}
              />
              <p className="mt-1 text-sm text-gray-500">Choose ETH or an ERC20 token to transfer</p>
            </div>

            {/* Amount */}
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                Amount {selectedToken ? `(${selectedToken.symbol})` : ""}
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
                className="block w-full mt-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
              <div className="mt-1 text-sm text-gray-500">
                Available:
                {selectedToken?.address === "ETH" || !selectedToken ? (
                  <span className="relative ml-1 group">
                    {formatBalance(account?.balance)} ETH
                    {/* Tooltip for available balance */}
                    <div className="absolute left-0 z-20 invisible px-3 py-2 mb-2 text-sm text-white transition-all duration-200 bg-gray-900 rounded-lg opacity-0 bottom-full group-hover:opacity-100 group-hover:visible whitespace-nowrap">
                      <div className="font-mono">Exact: {account?.balance || "0"} ETH</div>
                      <div className="absolute w-0 h-0 border-t-4 border-l-4 border-r-4 top-full left-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                    </div>
                  </span>
                ) : loadingTokenBalance ? (
                  <span className="ml-1 text-gray-600">
                    Loading {selectedToken.symbol} balance...
                  </span>
                ) : tokenBalance ? (
                  <span className="relative ml-1 group">
                    {tokenBalance.formattedBalance} {selectedToken.symbol}
                    {/* Tooltip for available balance */}
                    <div className="absolute left-0 z-20 invisible px-3 py-2 mb-2 text-sm text-white transition-all duration-200 bg-gray-900 rounded-lg opacity-0 bottom-full group-hover:opacity-100 group-hover:visible whitespace-nowrap">
                      <div className="font-mono">
                        Exact: {tokenBalance.formattedBalance} {selectedToken.symbol}
                      </div>
                      <div className="absolute w-0 h-0 border-t-4 border-l-4 border-r-4 top-full left-4 border-l-transparent border-r-transparent border-t-gray-900"></div>
                    </div>
                  </span>
                ) : (
                  <span className="ml-1 text-red-600">0 {selectedToken.symbol}</span>
                )}
                {/* Show insufficient balance warning */}
                {formData.amount &&
                  ((selectedToken?.address === "ETH" &&
                    parseFloat(formData.amount) > parseFloat(account?.balance || "0")) ||
                    (selectedToken &&
                      selectedToken.address !== "ETH" &&
                      tokenBalance &&
                      parseFloat(formData.amount) >
                        parseFloat(tokenBalance.formattedBalance || "0"))) && (
                    <span className="ml-2 text-red-600">⚠️ Insufficient balance</span>
                  )}
              </div>
            </div>

            {/* Paymaster Option */}
            <div className="p-4 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200">
              <div className="flex items-start">
                <div className="flex items-center h-5">
                  <input
                    id="usePaymaster"
                    name="usePaymaster"
                    type="checkbox"
                    checked={formData.usePaymaster}
                    onChange={handleChange}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                </div>
                <div className="ml-3">
                  <label htmlFor="usePaymaster" className="text-sm font-medium text-gray-900">
                    Use Paymaster (Sponsored Gas) ✨
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    Enable this to have gas fees sponsored by Pimlico Paymaster. Perfect for users
                    without ETH for gas!
                  </p>
                  {formData.usePaymaster && (
                    <div className="mt-2 text-xs text-purple-700 bg-purple-100 rounded px-2 py-1 inline-block">
                      🎉 Gas will be sponsored - No ETH needed for fees!
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Gas Estimation */}
            {gasEstimate && (
              <div className="p-4 rounded-lg bg-gray-50">
                <h3 className="mb-2 text-sm font-medium text-gray-900">Gas Estimation</h3>
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
                className="inline-flex items-center justify-center flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading.estimate ? (
                  <div className="w-4 h-4 mr-2 border-b-2 border-gray-600 rounded-full animate-spin"></div>
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
                  <div className="w-4 h-4 mr-2 border-b-2 border-white rounded-full animate-spin"></div>
                ) : (
                  <ArrowUpIcon className="w-4 h-4 mr-2" />
                )}
                {(() => {
                  if (!formData.amount) return "Send Transfer";
                  const transferAmount = parseFloat(formData.amount);

                  if (!selectedToken || selectedToken.address === "ETH") {
                    return transferAmount > parseFloat(account?.balance || "0")
                      ? "Insufficient ETH Balance"
                      : "Send Transfer";
                  }

                  return `Send ${selectedToken.symbol}`;
                })()}
              </button>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="p-4 mt-6 rounded-lg bg-blue-50">
          <div className="flex">
            <InformationCircleIcon className="w-5 h-5 text-blue-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">How it works</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="space-y-1 list-disc list-inside">
                  <li>Support for ETH and ERC20 token transfers (PNTs, PIM, and custom tokens)</li>
                  <li>Gas fees are automatically handled - no need to hold ETH for gas</li>
                  <li>Enable Paymaster for sponsored transactions (zero gas cost!)</li>
                  <li>Add custom tokens by entering their contract address</li>
                  <li>BLS nodes are automatically selected from the gossip network</li>
                  <li>Uses ERC-4337 UserOperation with BLS aggregate signatures</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
