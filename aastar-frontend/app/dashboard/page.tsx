"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import CopyButton from "@/components/CopyButton";
import CreateAccountDialog from "@/components/CreateAccountDialog";
import { accountAPI, transferAPI, paymasterAPI, tokenAPI } from "@/lib/api";
import { Account, Transfer, User, TokenBalance, EntryPointVersion } from "@/lib/types";
import { getStoredAuth } from "@/lib/auth";
import toast from "react-hot-toast";
import {
  WalletIcon,
  PlusIcon,
  ArrowUpIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  EyeIcon,
  CpuChipIcon,
} from "@heroicons/react/24/outline";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [paymasters, setPaymasters] = useState<any[]>([]);
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const { user: storedUser } = getStoredAuth();
    if (storedUser) {
      setUser(storedUser);
      loadDashboardData();
    }
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      let accountData = null;

      // Try to get account
      try {
        const accountResponse = await accountAPI.getAccount();
        console.log("Dashboard received account data:", accountResponse);
        console.log("Account data:", accountResponse.data);
        console.log("Account address:", accountResponse.data?.address);
        console.log("Account creatorAddress:", accountResponse.data?.creatorAddress);
        accountData = accountResponse.data;
        setAccount(accountData);
      } catch {
        // Account doesn't exist yet
        setAccount(null);
      }

      // Get transfer history
      try {
        const transferResponse = await transferAPI.getHistory(1, 5);
        setTransfers(transferResponse.data.transfers);
      } catch {
        setTransfers([]);
      }

      // Get available paymasters
      try {
        const paymasterResponse = await paymasterAPI.getAvailable();
        setPaymasters(paymasterResponse.data);
      } catch {
        setPaymasters([]);
      }

      // Get token balances if account exists
      if (accountData?.address) {
        try {
          const tokenResponse = await tokenAPI.getAllTokenBalances(accountData.address);
          setTokenBalances(tokenResponse.data);
        } catch {
          setTokenBalances([]);
        }
      }
    } catch (error: any) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAccountCreated = (newAccount: Account) => {
    setAccount(newAccount);
    // Reload data to get updated balance
    setTimeout(() => loadDashboardData(), 2000);
  };

  const getVersionBadge = (version?: string) => {
    if (!version) return null;

    const versionColors: Record<string, string> = {
      "0.6": "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
      "0.7": "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
      // "0.8": "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400", // Temporarily disabled
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${versionColors[version] || "bg-gray-100 text-gray-800"}`}
      >
        v{version}
      </span>
    );
  };

  const showTopUpInfo = () => {
    if (!account?.address) {
      toast.error("No account address found");
      return;
    }

    toast.success(
      `Send ETH directly to your Smart Account: ${account.address.slice(0, 10)}...${account.address.slice(-8)}\nAddress copied to clipboard!`,
      { duration: 6000 }
    );

    // Copy address to clipboard
    navigator.clipboard.writeText(account.address);
  };

  // Sponsor account with 0.01 ETH
  const sponsorAccount = async () => {
    setActionLoading("sponsor");
    try {
      await accountAPI.sponsorAccount();
      toast.success("Account sponsored successfully! 🎉");

      // Reload dashboard data to update sponsored status and balance
      setTimeout(() => loadDashboardData(), 2000);
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to sponsor account";
      toast.error(message);
    } finally {
      setActionLoading("");
    }
  };

  // Check if sponsor button should be shown
  const shouldShowSponsorButton = () => {
    if (!account) return false;
    if (account.sponsored) return false;

    const balance = parseFloat(account.balance || "0");
    return balance <= 0.01;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case "failed":
        return <ExclamationCircleIcon className="w-5 h-5 text-red-500" />;
      case "pending":
      case "submitted":
        return <ClockIcon className="w-5 h-5 text-yellow-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />;
    }
  };

  if (loading) {
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
      <div className="px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user?.username || user?.email}!
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage your ERC-4337 smart account - no need to manage gas fees!
          </p>
        </div>

        {/* Account Status */}
        <div className="grid grid-cols-1 gap-6 mb-8 lg:grid-cols-3">
          {/* Account Card */}
          <div className="col-span-1 lg:col-span-2">
            <div className="overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <WalletIcon className="w-8 h-8 text-blue-500" />
                  </div>
                  <div className="flex-1 ml-4">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        Smart Account
                      </h3>
                      {account && getVersionBadge(account.entryPointVersion)}
                    </div>
                    {account ? (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Account Address:
                          </span>
                          <CopyButton text={account.address} className="flex-shrink-0" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Balance:
                          </span>
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                            {account.balance || "0"} ETH
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              account.deployed
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400"
                            }`}
                          >
                            {account.deployed ? "Deployed" : "Not Deployed"}
                          </span>
                        </div>
                        {account.entryPointVersion && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              <CpuChipIcon className="inline w-3 h-3 mr-1" />
                              EntryPoint:
                            </span>
                            <span className="text-sm font-mono text-gray-800 dark:text-gray-200">
                              v{account.entryPointVersion}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        No smart account found. Create one to get started - deployment and gas fees
                        are automatically handled!
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex mt-6 space-x-3">
                  {!account ? (
                    <button
                      onClick={() => setShowCreateDialog(true)}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <PlusIcon className="w-4 h-4 mr-2" />
                      Create Account
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => router.push("/transfer")}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <ArrowUpIcon className="w-4 h-4 mr-2" />
                        Send Transfer
                      </button>
                      <button
                        onClick={showTopUpInfo}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        Top Up
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="col-span-1">
            <div className="overflow-hidden bg-white dark:bg-gray-800 rounded-lg shadow-sm">
              <div className="p-6">
                <h3 className="mb-4 text-lg font-medium text-gray-900 dark:text-white">
                  Quick Actions
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push("/transfer")}
                    disabled={!account?.deployed}
                    className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-100 border border-transparent rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowUpIcon className="w-4 h-4 mr-2" />
                    Send Transfer
                  </button>
                  <button
                    onClick={() => loadDashboardData()}
                    className="inline-flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <EyeIcon className="w-4 h-4 mr-2" />
                    Refresh Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Token Balances */}
        {account && tokenBalances.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Token Balances
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tokenBalances
                  .filter(balance => parseFloat(balance.formattedBalance) > 0)
                  .map(tokenBalance => (
                    <div
                      key={tokenBalance.token.address}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-center">
                        {tokenBalance.token.logoUrl && (
                          <img
                            src={tokenBalance.token.logoUrl}
                            alt={tokenBalance.token.symbol}
                            className="w-8 h-8 mr-3 rounded-full"
                            onError={e => {
                              (e.target as HTMLImageElement).style.display = "none";
                            }}
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {tokenBalance.token.symbol}
                            </span>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              {parseFloat(tokenBalance.formattedBalance).toFixed(4)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {tokenBalance.token.name}
                          </p>
                          {tokenBalance.token.isCustom && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mt-1">
                              Custom
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
              {tokenBalances.filter(balance => parseFloat(balance.formattedBalance) > 0).length ===
                0 && (
                <div className="text-center py-6">
                  <WalletIcon className="w-12 h-12 mx-auto text-gray-500 dark:text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                    No token balances
                  </h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    Your account doesn&apos;t have any ERC20 tokens yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Paymaster Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                🎉 Paymaster Status
              </h3>
            </div>
            <div className="space-y-3">
              {paymasters.filter(pm => pm.configured).length > 0 ? (
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Available gas sponsors for your transactions:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {paymasters
                      .filter(pm => pm.configured)
                      .map(paymaster => (
                        <div
                          key={paymaster.name}
                          className="p-3 border border-green-200 dark:border-green-800 rounded-lg bg-green-50 dark:bg-green-900/20"
                        >
                          <div className="flex items-center">
                            <CheckCircleIcon className="w-5 h-5 text-green-500 mr-2" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {paymaster.name === "pimlico-sepolia" ? "Pimlico" : paymaster.name}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                                {paymaster.address.slice(0, 10)}...{paymaster.address.slice(-8)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-3">
                    ✨ Enable &quot;Use Paymaster&quot; when sending transfers for sponsored gas!
                  </p>
                </div>
              ) : (
                <div className="p-4 border border-yellow-200 dark:border-yellow-800 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                  <div className="flex">
                    <ExclamationCircleIcon className="w-5 h-5 text-yellow-400 mr-2" />
                    <div>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        No Paymaster configured. Transactions will use your account balance for gas.
                      </p>
                      <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">
                        Configure a Paymaster API key in the backend to enable gas sponsorship.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Transfers */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Recent Transfers
              </h3>
              <button
                onClick={() => router.push("/transfer/history")}
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                View all
              </button>
            </div>

            {transfers.length > 0 ? (
              <div className="space-y-4">
                {transfers.map(transfer => (
                  <div
                    key={transfer.id}
                    className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center">
                      <div className="mr-3">{getStatusIcon(transfer.status)}</div>
                      <div>
                        <div className="flex items-center space-x-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            To:
                          </span>
                          <CopyButton text={transfer.to} className="text-sm" />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(transfer.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        -{transfer.amount} {transfer.tokenSymbol || "ETH"}
                      </p>
                      <p
                        className={`text-xs capitalize ${
                          transfer.status === "completed"
                            ? "text-green-600"
                            : transfer.status === "failed"
                              ? "text-red-600"
                              : "text-yellow-600"
                        }`}
                      >
                        {transfer.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center">
                <WalletIcon className="w-12 h-12 mx-auto text-gray-500 dark:text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  No transfers yet
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Start by sending your first transfer!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Account Dialog */}
      <CreateAccountDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSuccess={handleAccountCreated}
      />
    </Layout>
  );
}
