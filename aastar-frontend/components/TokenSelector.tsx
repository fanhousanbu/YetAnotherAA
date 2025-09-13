"use client";

import { useState, useEffect, Fragment } from "react";
import { Listbox, Transition, Dialog } from "@headlessui/react";
import { ChevronUpDownIcon, CheckIcon, PlusIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { Token, TokenBalance } from "@/lib/types";
import { tokenAPI } from "@/lib/api";
import toast from "react-hot-toast";

interface TokenSelectorProps {
  selectedToken: Token | null;
  onTokenChange: (token: Token | null) => void;
  accountAddress?: string;
  showBalances?: boolean;
  className?: string;
}

export default function TokenSelector({
  selectedToken,
  onTokenChange,
  accountAddress,
  showBalances = true,
  className = "",
}: TokenSelectorProps) {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [balances, setBalances] = useState<{ [address: string]: TokenBalance }>({});
  const [loading, setLoading] = useState(true);
  const [refreshingBalances, setRefreshingBalances] = useState<{ [address: string]: boolean }>({});
  const [showCustomTokenModal, setShowCustomTokenModal] = useState(false);
  const [customTokenAddress, setCustomTokenAddress] = useState("");
  const [validatingToken, setValidatingToken] = useState(false);

  // No ETH token in ERC20 selector

  useEffect(() => {
    loadTokens();
  }, [accountAddress]);

  const loadTokens = async () => {
    setLoading(true);
    try {
      // Load preset tokens
      const presetResponse = await tokenAPI.getPresetTokens();
      const presetTokens = presetResponse.data;

      // Only show ERC20 tokens, no ETH
      setTokens(presetTokens);

      // Load balances if account address is provided
      if (accountAddress && showBalances) {
        await loadBalances(presetTokens);
      }
    } catch (error) {
      console.error("Failed to load tokens:", error);
      toast.error("Failed to load tokens");
    } finally {
      setLoading(false);
    }
  };

  const loadBalances = async (tokensToLoad: Token[]) => {
    try {
      const newBalances: { [address: string]: TokenBalance } = {};

      // Process tokens sequentially to avoid rate limiting
      for (let i = 0; i < tokensToLoad.length; i++) {
        const token = tokensToLoad[i];

        // Skip non-ERC20 tokens
        if (!token.address || token.address === "ETH") {
          continue;
        }

        try {
          // Add delay between requests to avoid rate limiting
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 800));
          }

          const response = await tokenAPI.getTokenBalance(token.address);
          console.log(`Token ${token.symbol} balance response:`, response.data);
          if (response.data) {
            newBalances[token.address] = response.data;
            console.log(`Added balance for ${token.symbol}:`, response.data);
          }
        } catch (error) {
          console.error(`Failed to load balance for ${token.symbol}:`, error);
          // Continue with next token instead of failing completely
        }
      }

      console.log("Final balances to set:", newBalances);
      setBalances(newBalances);
    } catch (error) {
      console.error("Failed to load balances:", error);
    }
  };

  const addCustomToken = async () => {
    if (!customTokenAddress) {
      toast.error("Please enter a token address");
      return;
    }

    setValidatingToken(true);
    try {
      const response = await tokenAPI.validateToken({ address: customTokenAddress });

      if (response.data.isValid) {
        const newToken = response.data.token;
        const updatedTokens = [...tokens, newToken];
        setTokens(updatedTokens);

        // Load balance for the new token
        if (accountAddress && showBalances) {
          try {
            const balanceResponse = await tokenAPI.getTokenBalance(newToken.address);
            setBalances(prev => ({
              ...prev,
              [newToken.address]: balanceResponse.data,
            }));
          } catch {
            // Ignore balance loading errors for custom tokens
          }
        }

        toast.success(`Added ${newToken.symbol} token`);
        setCustomTokenAddress("");
        setShowCustomTokenModal(false);
      } else {
        toast.error("Invalid token address or not an ERC20 token");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to validate token");
    } finally {
      setValidatingToken(false);
    }
  };

  const refreshSingleTokenBalance = async (token: Token) => {
    if (!accountAddress || !showBalances || token.address === "ETH") return;

    setRefreshingBalances(prev => ({ ...prev, [token.address]: true }));
    try {
      const response = await tokenAPI.getTokenBalance(token.address);
      if (response.data) {
        setBalances(prev => ({
          ...prev,
          [token.address]: response.data,
        }));
        toast.success(`${token.symbol} balance refreshed`);
      }
    } catch (error) {
      console.error(`Failed to refresh ${token.symbol} balance:`, error);
      toast.error(`Failed to refresh ${token.symbol} balance`);
    } finally {
      setRefreshingBalances(prev => ({ ...prev, [token.address]: false }));
    }
  };

  const formatBalance = (balance?: string, decimals?: number) => {
    if (!balance || !decimals) return "0";
    try {
      const num = parseFloat(balance);
      if (num === 0) return "0";
      if (num >= 1) return num.toFixed(4);
      if (num >= 0.0001) return num.toFixed(6);
      return num.toExponential(2);
    } catch {
      return "0";
    }
  };

  const getTokenBalance = (token: Token) => {
    const balance = balances[token.address];
    console.log(`Getting balance for ${token.symbol}:`, balance);
    if (!balance) return null;
    // formattedBalance is already formatted, just return it directly
    console.log(`Formatted balance for ${token.symbol}:`, balance.formattedBalance);
    return balance.formattedBalance;
  };

  if (loading) {
    return (
      <div className={`relative ${className}`}>
        <div className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-center">
            <div className="w-4 h-4 border-b-2 border-blue-500 dark:border-blue-400 rounded-full animate-spin"></div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-300">Loading tokens...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`relative ${className}`}>
        <Listbox value={selectedToken} onChange={onTokenChange}>
          <div className="relative">
            <Listbox.Button className="relative w-full py-3 pl-3 pr-10 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm cursor-default focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 sm:text-sm">
              <div className="flex items-center">
                {selectedToken ? (
                  <>
                    <div className="flex items-center justify-center w-6 h-6 mr-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
                      {selectedToken.logoUrl ? (
                        <img
                          src={selectedToken.logoUrl}
                          alt={selectedToken.symbol}
                          className="w-6 h-6 rounded-full"
                          onError={e => {
                            // Replace failed image with fallback
                            const target = e.target as HTMLImageElement;
                            target.style.display = "none";
                            const parent = target.parentElement;
                            if (parent && !parent.querySelector(".fallback-icon")) {
                              const fallback = document.createElement("span");
                              fallback.className = "fallback-icon text-sm font-bold text-white";
                              fallback.textContent = selectedToken.symbol.charAt(0);
                              parent.appendChild(fallback);
                            }
                          }}
                        />
                      ) : (
                        <span className="text-sm font-bold text-white">
                          {selectedToken.symbol.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="block font-medium text-gray-900 dark:text-gray-100">
                        {selectedToken.symbol}
                      </span>
                      <span className="block text-sm text-gray-600 dark:text-gray-400">
                        {selectedToken.name}
                      </span>
                    </div>
                    {showBalances && accountAddress && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {getTokenBalance(selectedToken) || "0"}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="block text-gray-500 dark:text-gray-400">
                    Select an ERC20 token (optional)
                  </span>
                )}
              </div>
              <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                <ChevronUpDownIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </span>
            </Listbox.Button>

            <Transition
              as={Fragment}
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <Listbox.Options className="absolute z-10 w-full py-1 mt-1 overflow-auto text-base bg-white dark:bg-gray-800 rounded-md shadow-lg max-h-60 ring-1 ring-black dark:ring-gray-600 ring-opacity-5 dark:ring-opacity-50 focus:outline-none sm:text-sm">
                {tokens.map(token => (
                  <Listbox.Option
                    key={token.address}
                    className={({ active }) =>
                      `relative cursor-default select-none py-2 pl-3 pr-9 ${
                        active
                          ? "bg-blue-600 dark:bg-blue-600 text-white"
                          : "text-gray-900 dark:text-gray-100"
                      }`
                    }
                    value={token}
                  >
                    {({ selected, active }) => (
                      <>
                        <div className="flex items-center">
                          <div className="flex items-center justify-center w-6 h-6 mr-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600">
                            {token.logoUrl ? (
                              <img
                                src={token.logoUrl}
                                alt={token.symbol}
                                className="w-6 h-6 rounded-full"
                                onError={e => {
                                  // Replace failed image with fallback
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                  const parent = target.parentElement;
                                  if (parent && !parent.querySelector(".fallback-icon")) {
                                    const fallback = document.createElement("span");
                                    fallback.className =
                                      "fallback-icon text-sm font-bold text-white";
                                    fallback.textContent = token.symbol.charAt(0);
                                    parent.appendChild(fallback);
                                  }
                                }}
                              />
                            ) : (
                              <span className="text-sm font-bold text-white">
                                {token.symbol.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className="flex-1">
                            <span
                              className={`block font-medium ${
                                selected ? "font-semibold" : "font-normal"
                              }`}
                            >
                              {token.symbol}
                            </span>
                            <span
                              className={`block text-sm ${
                                active
                                  ? "text-blue-200 dark:text-blue-200"
                                  : "text-gray-600 dark:text-gray-400"
                              }`}
                            >
                              {token.name}
                            </span>
                          </div>
                          {showBalances && accountAddress && (
                            <div className="flex items-center space-x-2">
                              <span
                                className={`text-sm ${active ? "text-blue-200 dark:text-blue-200" : "text-gray-600 dark:text-gray-400"}`}
                              >
                                {getTokenBalance(token) || "0"}
                              </span>
                              {token.address !== "ETH" && (
                                <button
                                  onClick={e => {
                                    e.stopPropagation();
                                    refreshSingleTokenBalance(token);
                                  }}
                                  disabled={refreshingBalances[token.address]}
                                  className={`p-1 rounded hover:bg-opacity-20 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    active
                                      ? "text-blue-200 dark:text-blue-200 hover:bg-white dark:hover:bg-gray-700"
                                      : "text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                                  }`}
                                  title={`Refresh ${token.symbol} balance`}
                                >
                                  <ArrowPathIcon
                                    className={`w-4 h-4 ${
                                      refreshingBalances[token.address] ? "animate-spin" : ""
                                    }`}
                                  />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {selected ? (
                          <span
                            className={`absolute inset-y-0 right-0 flex items-center pr-4 ${
                              active ? "text-white" : "text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            <CheckIcon className="w-5 h-5" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Listbox.Option>
                ))}

                {/* Add Custom Token Option */}
                <div className="border-t border-gray-200 dark:border-gray-600">
                  <button
                    onClick={() => setShowCustomTokenModal(true)}
                    className="relative flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <PlusIcon className="w-5 h-5 mr-3 text-gray-500 dark:text-gray-400" />
                    <span>Add Custom Token</span>
                  </button>
                </div>
              </Listbox.Options>
            </Transition>
          </div>
        </Listbox>
      </div>

      {/* Custom Token Modal */}
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
                      Enter the contract address of an ERC20 token
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
    </>
  );
}
