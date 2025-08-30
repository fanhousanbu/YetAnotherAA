"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import CopyButton from "@/components/CopyButton";
import { accountAPI, transferAPI } from "@/lib/api";
import { Account, Transfer, User } from "@/lib/types";
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
} from "@heroicons/react/24/outline";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");
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
      // Try to get account
      try {
        const accountResponse = await accountAPI.getAccount();
        console.log('Dashboard received account data:', accountResponse);
        console.log('Account data:', accountResponse.data);
        console.log('Account address:', accountResponse.data?.address);
        console.log('Account ownerAddress:', accountResponse.data?.ownerAddress);
        setAccount(accountResponse.data);
      } catch (error) {
        // Account doesn't exist yet
        setAccount(null);
      }

      // Get transfer history
      try {
        const transferResponse = await transferAPI.getHistory(1, 5);
        setTransfers(transferResponse.data.transfers);
      } catch (error) {
        setTransfers([]);
      }
    } catch (error: any) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async () => {
    setActionLoading("create");
    try {
      const response = await accountAPI.create({
        deploy: true,
      });
      setAccount(response.data);
      toast.success("Account created successfully!");
      // Reload data to get updated balance
      setTimeout(() => loadDashboardData(), 2000);
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to create account";
      toast.error(message);
    } finally {
      setActionLoading("");
    }
  };

  const showTopUpInfo = () => {
    if (!account?.address) {
      toast.error("No account address found");
      return;
    }

    toast.success(
      `Send ETH to: ${account.address.slice(0, 10)}...${account.address.slice(-8)}\nAddress copied to clipboard!`,
      { duration: 5000 }
    );
    
    // Copy address to clipboard
    navigator.clipboard.writeText(account.address);
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
        return <ClockIcon className="h-5 w-5 text-gray-500" />;
    }
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (loading) {
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.username || user?.email}!
          </h1>
          <p className="mt-1 text-sm text-gray-600">Manage your ERC-4337 smart account</p>
        </div>

        {/* Account Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Account Card */}
          <div className="col-span-1 lg:col-span-2">
            <div className="bg-white overflow-hidden shadow-sm rounded-lg">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <WalletIcon className="h-8 w-8 text-blue-500" />
                  </div>
                  <div className="ml-4 flex-1">
                    <h3 className="text-lg font-medium text-gray-900">Smart Account</h3>
                    {(() => {
                      console.log('Rendering account:', account);
                      console.log('Account address in render:', account?.address);
                      console.log('Account ownerAddress in render:', account?.ownerAddress);
                      return null;
                    })()}
                    {account ? (
                      <div className="mt-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">EOA Address:</span>
                          <CopyButton text={account.ownerAddress} className="flex-shrink-0" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Smart Account:</span>
                          <CopyButton text={account.address} className="flex-shrink-0" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">EOA Balance:</span>
                          <span className="text-sm font-semibold text-green-600">
                            {account.eoaBalance || "0"} ETH
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Smart Account Balance:</span>
                          <span className="text-sm font-semibold">
                            {account.balance || "0"} ETH
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-500">Status:</span>
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              account.deployed
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {account.deployed ? "Deployed" : "Not Deployed"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-gray-600">
                        No smart account found. Create one to get started.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex space-x-3">
                  {!account ? (
                    <button
                      onClick={createAccount}
                      disabled={actionLoading === "create"}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {actionLoading === "create" ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      ) : (
                        <PlusIcon className="h-4 w-4 mr-2" />
                      )}
                      Create Account
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => router.push("/transfer")}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <ArrowUpIcon className="h-4 w-4 mr-2" />
                        Send Transfer
                      </button>
                      <button
                        onClick={showTopUpInfo}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <PlusIcon className="h-4 w-4 mr-2" />
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
            <div className="bg-white overflow-hidden shadow-sm rounded-lg">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push("/transfer")}
                    disabled={!account?.deployed}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-600 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArrowUpIcon className="h-4 w-4 mr-2" />
                    Send Transfer
                  </button>
                  <button
                    onClick={() => loadDashboardData()}
                    className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <EyeIcon className="h-4 w-4 mr-2" />
                    Refresh Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transfers */}
        <div className="bg-white shadow-sm rounded-lg">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Recent Transfers</h3>
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
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center">
                      <div className="mr-3">{getStatusIcon(transfer.status)}</div>
                      <div>
                        <div className="flex items-center space-x-1">
                          <span className="text-sm font-medium text-gray-900">To:</span>
                          <CopyButton text={transfer.to} className="text-sm" />
                        </div>
                        <p className="text-sm text-gray-500">
                          {new Date(transfer.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">-{transfer.amount} ETH</p>
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
              <div className="text-center py-6">
                <WalletIcon className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No transfers yet</h3>
                <p className="mt-1 text-sm text-gray-500">Start by sending your first transfer!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
