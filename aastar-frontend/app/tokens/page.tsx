"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { userTokenAPI } from "@/lib/api";
import { UserToken, UserTokenWithBalance } from "@/lib/types";
import TokenIcon from "@/components/TokenIcon";
import toast from "react-hot-toast";
import {
  MagnifyingGlassIcon,
  PlusIcon,
  ArrowPathIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";

export default function TokensPage() {
  const [userTokens, setUserTokens] = useState<UserTokenWithBalance[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<UserTokenWithBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyWithBalance, setShowOnlyWithBalance] = useState(false);
  const [showCustomTokenModal, setShowCustomTokenModal] = useState(false);
  const [customTokenAddress, setCustomTokenAddress] = useState("");
  const [validatingToken, setValidatingToken] = useState(false);

  useEffect(() => {
    loadUserTokens();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [userTokens, searchQuery, showOnlyWithBalance]);

  const loadUserTokens = async (withBalances: boolean = true) => {
    try {
      setLoading(true);
      const response = await userTokenAPI.getUserTokens({
        activeOnly: true,
        withBalances,
      });
      setUserTokens(response.data);
    } catch (error: any) {
      if (
        error.response?.status === 404 ||
        error.response?.data?.message?.includes("No tokens found")
      ) {
        // User has no tokens yet, initialize with defaults
        await initializeUserTokens();
      } else {
        toast.error("Failed to load tokens");
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const initializeUserTokens = async () => {
    try {
      await userTokenAPI.initializeDefaultTokens();
      toast.success("Default tokens initialized");
      await loadUserTokens();
    } catch (error: any) {
      toast.error("Failed to initialize default tokens");
      console.error(error);
    }
  };

  const refreshBalances = async () => {
    try {
      setBalancesLoading(true);
      await loadUserTokens(true);
      toast.success("Balances refreshed");
    } catch (error: any) {
      toast.error("Failed to refresh balances");
      console.error(error);
    } finally {
      setBalancesLoading(false);
    }
  };

  const addCustomToken = async () => {
    if (!customTokenAddress) {
      toast.error("Please enter a token address");
      return;
    }

    setValidatingToken(true);
    try {
      const response = await userTokenAPI.addUserToken({ address: customTokenAddress });
      toast.success(`Added ${response.data.symbol} token`);
      setCustomTokenAddress("");
      setShowCustomTokenModal(false);
      await loadUserTokens();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add token");
    } finally {
      setValidatingToken(false);
    }
  };

  const removeToken = async (tokenId: string, tokenSymbol: string) => {
    try {
      await userTokenAPI.removeUserToken(tokenId);
      toast.success(`Removed ${tokenSymbol} from your list`);
      await loadUserTokens();
    } catch (error: any) {
      toast.error("Failed to remove token");
      console.error(error);
    }
  };

  const applyFilters = () => {
    let filtered = [...userTokens];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        token =>
          token.symbol.toLowerCase().includes(query) ||
          token.name.toLowerCase().includes(query) ||
          token.address.toLowerCase().includes(query)
      );
    }

    // Balance filter
    if (showOnlyWithBalance) {
      filtered = filtered.filter(token => {
        const balance = token.balance;
        return balance && parseFloat(balance.formattedBalance) > 0;
      });
    }

    // Sort: by sortOrder first, then alphabetically
    filtered.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return a.sortOrder - b.sortOrder;
      }
      return a.symbol.localeCompare(b.symbol);
    });

    setFilteredTokens(filtered);
  };

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return "0";
    if (num >= 1) return num.toFixed(4);
    if (num >= 0.0001) return num.toFixed(6);
    return num.toExponential(2);
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
      <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Tokens</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Manage your personal ERC20 token list
          </p>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
            </div>
            <input
              type="text"
              placeholder="Search tokens by name, symbol, or address..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filter Controls */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* With Balance Only */}
            <label className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={showOnlyWithBalance}
                onChange={e => setShowOnlyWithBalance(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>With balance only</span>
            </label>

            {/* Add Custom Token Button */}
            <button
              onClick={() => setShowCustomTokenModal(true)}
              className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <PlusIcon className="h-4 w-4 mr-2" />
              Add Token
            </button>

            {/* Refresh Balances */}
            <button
              onClick={refreshBalances}
              disabled={balancesLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ArrowPathIcon className={`h-4 w-4 mr-2 ${balancesLoading ? "animate-spin" : ""}`} />
              Refresh
            </button>

            {/* Results Count */}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {filteredTokens.length} of {userTokens.length} tokens
            </span>
          </div>
        </div>

        {/* Token Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTokens.map(token => (
            <div
              key={token.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  {/* Token Icon */}
                  <TokenIcon token={token} size="xl" />

                  {/* Token Info */}
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {token.symbol}
                      </h3>
                      {token.isCustom && (
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded">
                          Custom
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{token.name}</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => removeToken(token.id, token.symbol)}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title="Remove token"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Balance */}
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Balance</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {token.balance ? formatBalance(token.balance.formattedBalance) : "0"}{" "}
                  {token.symbol}
                </div>
                {balancesLoading && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">Loading...</div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
                {/* Address */}
                <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {token.address.slice(0, 6)}...{token.address.slice(-4)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredTokens.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 text-gray-400 dark:text-gray-500">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No tokens found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {searchQuery || showOnlyWithBalance
                ? "Try adjusting your search query or filters."
                : "Add your first custom token to get started."}
            </p>
            {!searchQuery && !showOnlyWithBalance && (
              <button
                onClick={() => setShowCustomTokenModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Token
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add Custom Token Modal */}
      <Transition appear show={showCustomTokenModal} as={Fragment}>
        <Dialog
          as="div"
          className="relative z-50"
          onClose={() => !validatingToken && setShowCustomTokenModal(false)}
        >
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black dark:bg-black bg-opacity-25 dark:bg-opacity-50" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex items-center justify-center min-h-full p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md p-6 overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
                  >
                    Add Custom Token
                  </Dialog.Title>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Token Contract Address
                    </label>
                    <input
                      type="text"
                      value={customTokenAddress}
                      onChange={e => setCustomTokenAddress(e.target.value)}
                      placeholder="0x..."
                      className="block w-full mt-1 bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-md shadow-sm focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      Enter the contract address of an ERC20 token. Token information will be
                      automatically fetched.
                    </p>
                  </div>

                  <div className="flex justify-end mt-6 space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowCustomTokenModal(false)}
                      disabled={validatingToken}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={addCustomToken}
                      disabled={validatingToken || !customTokenAddress}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {validatingToken ? (
                        <>
                          <div className="w-4 h-4 mr-2 border-b-2 border-white dark:border-white rounded-full animate-spin"></div>
                          Validating...
                        </>
                      ) : (
                        "Add Token"
                      )}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </Layout>
  );
}
