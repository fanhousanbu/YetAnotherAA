"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { userNFTAPI } from "@/lib/api";
import { UserNFT, NFTStandard, NFTStats } from "@/lib/types";
import NFTCard from "@/components/NFTCard";
import toast from "react-hot-toast";
import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";

export default function NFTsPage() {
  const router = useRouter();
  const [nfts, setNfts] = useState<UserNFT[]>([]);
  const [filteredNfts, setFilteredNfts] = useState<UserNFT[]>([]);
  const [stats, setStats] = useState<NFTStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [standardFilter, setStandardFilter] = useState<NFTStandard | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingNFT, setAddingNFT] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<UserNFT | null>(null);

  // Form state
  const [contractAddress, setContractAddress] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [nftStandard, setNftStandard] = useState<NFTStandard>(NFTStandard.ERC721);

  useEffect(() => {
    loadNFTs();
    loadStats();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [nfts, searchQuery, standardFilter]);

  const loadNFTs = async () => {
    try {
      setLoading(true);
      const response = await userNFTAPI.getUserNFTs({ activeOnly: true });
      setNfts(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        setNfts([]);
      } else {
        toast.error("Failed to load NFTs");
        console.error(error);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await userNFTAPI.getNFTStats();
      setStats(response.data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  };

  const applyFilters = () => {
    let filtered = [...nfts];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        nft =>
          nft.name.toLowerCase().includes(query) ||
          nft.collectionName?.toLowerCase().includes(query) ||
          nft.tokenId.toLowerCase().includes(query) ||
          nft.contractAddress.toLowerCase().includes(query)
      );
    }

    // Standard filter
    if (standardFilter !== "all") {
      filtered = filtered.filter(nft => nft.standard === standardFilter);
    }

    // Sort by creation date
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    setFilteredNfts(filtered);
  };

  const openAddModal = () => {
    setContractAddress("");
    setTokenId("");
    setNftStandard(NFTStandard.ERC721);
    setShowAddModal(true);
  };

  const addNFT = async () => {
    if (!contractAddress || !tokenId) {
      toast.error("Please enter contract address and token ID");
      return;
    }

    setAddingNFT(true);
    try {
      await userNFTAPI.addUserNFT({
        contractAddress,
        tokenId,
        standard: nftStandard,
      });
      toast.success("NFT added successfully");
      setShowAddModal(false);
      await loadNFTs();
      await loadStats();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to add NFT");
    } finally {
      setAddingNFT(false);
    }
  };

  const removeNFT = async (nftId: string) => {
    try {
      await userNFTAPI.removeUserNFT(nftId);
      toast.success("NFT removed from collection");
      await loadNFTs();
      await loadStats();
    } catch (error: any) {
      toast.error("Failed to remove NFT");
      console.error(error);
    }
  };

  const handleNFTClick = (nft: UserNFT) => {
    setSelectedNFT(nft);
  };

  return (
    <Layout requireAuth={true}>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
        {/* Mobile Header with Back Button */}
        <div className="md:hidden sticky top-0 bg-slate-100 dark:bg-slate-950 z-30 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="p-2 -ml-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white touch-manipulation active:scale-95"
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
              <svg
                className="w-6 h-6 text-slate-900 dark:text-emerald-400 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">My NFTs</h1>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
          {/* Header - Desktop only */}
          <div className="hidden md:block mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My NFTs</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Manage your NFT collection
            </p>
          </div>

          {/* Mobile Add Button - Fixed position */}
          <button
            onClick={openAddModal}
            className="md:hidden fixed bottom-24 right-6 z-50 inline-flex items-center justify-center w-14 h-14 text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 border border-transparent rounded-full shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:focus:ring-emerald-500 touch-manipulation active:scale-95"
            aria-label="Add NFT"
          >
            <PlusIcon className="w-6 h-6" />
          </button>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">Total NFTs</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">Collections</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.collections}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">ERC721</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.erc721}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">ERC1155</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {stats.erc1155}
                </p>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            {/* Search Bar */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Search by name, collection, token ID, or contract..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck="false"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-base sm:text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-400 focus:border-slate-900 dark:focus:border-emerald-400 transition-all"
              />
            </div>

            {/* Filter Controls */}
            <div className="flex flex-wrap gap-4 items-center">
              {/* Add NFT Button - Desktop only */}
              <button
                onClick={openAddModal}
                className="hidden md:inline-flex items-center px-3 py-3 sm:py-2 border border-transparent rounded-xl text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:focus:ring-emerald-500 touch-manipulation active:scale-95"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add NFT
              </button>

              {/* Standard Filter */}
              <select
                value={standardFilter}
                onChange={e => setStandardFilter(e.target.value as NFTStandard | "all")}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-emerald-400"
              >
                <option value="all">All Standards</option>
                <option value={NFTStandard.ERC721}>ERC721</option>
                <option value={NFTStandard.ERC1155}>ERC1155</option>
              </select>

              {/* Results Count */}
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {filteredNfts.length} of {nfts.length} NFTs
              </span>
            </div>
          </div>

          {/* NFT Grid */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-slate-900 dark:border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {filteredNfts.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                  {filteredNfts.map(nft => (
                    <NFTCard key={nft.id} nft={nft} onRemove={removeNFT} onClick={handleNFTClick} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-24 h-24 mx-auto mb-4 text-gray-400 dark:text-gray-500">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg sm:text-xl font-medium text-gray-900 dark:text-white mb-2">
                    No NFTs found
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {searchQuery || standardFilter !== "all"
                      ? "Try adjusting your filters."
                      : "Add your first NFT to get started."}
                  </p>
                  {!searchQuery && standardFilter === "all" && (
                    <button
                      onClick={openAddModal}
                      className="inline-flex items-center px-4 py-3 sm:py-2 border border-transparent rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:focus:ring-emerald-500 touch-manipulation active:scale-95"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Add NFT
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Add NFT Modal */}
        <Transition appear show={showAddModal} as={Fragment}>
          <Dialog
            as="div"
            className="relative z-50"
            onClose={() => !addingNFT && setShowAddModal(false)}
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
              <div className="hidden md:block fixed inset-0 bg-black dark:bg-black bg-opacity-25 dark:bg-opacity-50" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto flex items-stretch md:items-center justify-center">
              <div className="w-full h-full md:h-auto md:w-auto md:flex-shrink-0 md:p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 md:scale-95"
                  enterTo="opacity-100 md:scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 md:scale-100"
                  leaveTo="opacity-0 md:scale-95"
                >
                  <Dialog.Panel className="h-full md:h-auto w-full max-w-full md:max-w-lg p-0 md:p-6 md:sm:p-8 overflow-y-auto md:overflow-hidden text-left align-middle transition-all transform bg-white dark:bg-gray-800 md:shadow-xl md:rounded-2xl">
                    {/* Mobile Header */}
                    <div className="md:hidden sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center z-10">
                      <button
                        onClick={() => !addingNFT && setShowAddModal(false)}
                        className="mr-3 p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                      >
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 19l-7-7 7-7"
                          />
                        </svg>
                      </button>
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100"
                      >
                        Add NFT
                      </Dialog.Title>
                    </div>

                    {/* Desktop Title */}
                    <Dialog.Title
                      as="h3"
                      className="hidden md:block text-lg sm:text-xl font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4"
                    >
                      Add NFT
                    </Dialog.Title>

                    {/* Form */}
                    <div className="mt-4 px-4 md:px-0 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Contract Address
                        </label>
                        <input
                          type="text"
                          value={contractAddress}
                          onChange={e => setContractAddress(e.target.value)}
                          placeholder="0x..."
                          autoComplete="off"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck="false"
                          className="block w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 text-sm placeholder-gray-400 dark:placeholder-gray-500 transition-all font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Token ID
                        </label>
                        <input
                          type="text"
                          value={tokenId}
                          onChange={e => setTokenId(e.target.value)}
                          placeholder="1234"
                          autoComplete="off"
                          autoCapitalize="off"
                          autoCorrect="off"
                          spellCheck="false"
                          className="block w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 text-sm placeholder-gray-400 dark:placeholder-gray-500 transition-all font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          NFT Standard
                        </label>
                        <select
                          value={nftStandard}
                          onChange={e => setNftStandard(e.target.value as NFTStandard)}
                          className="block w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 text-sm transition-all"
                        >
                          <option value={NFTStandard.ERC721}>ERC721</option>
                          <option value={NFTStandard.ERC1155}>ERC1155</option>
                        </select>
                      </div>

                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        The NFT metadata will be automatically fetched from the blockchain.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row justify-end mt-6 gap-3 px-4 md:px-0 pb-4 md:pb-0">
                      <button
                        type="button"
                        onClick={() => setShowAddModal(false)}
                        disabled={addingNFT}
                        className="hidden md:inline-flex px-4 py-3 sm:py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-slate-900 dark:focus:ring-emerald-400 disabled:opacity-50 transition-all touch-manipulation active:scale-95"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={addNFT}
                        disabled={addingNFT || !contractAddress || !tokenId}
                        className="inline-flex items-center justify-center w-full md:w-auto px-4 py-3 sm:py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 border border-transparent rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-slate-900 dark:focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation active:scale-95"
                      >
                        {addingNFT ? (
                          <>
                            <div className="w-4 h-4 mr-2 border-b-2 border-white rounded-full animate-spin"></div>
                            Adding...
                          </>
                        ) : (
                          "Add NFT"
                        )}
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>

        {/* NFT Detail Modal */}
        <Transition appear show={selectedNFT !== null} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setSelectedNFT(null)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-50" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                    {selectedNFT && (
                      <>
                        <div className="flex justify-between items-start mb-4">
                          <Dialog.Title
                            as="h3"
                            className="text-xl font-bold text-gray-900 dark:text-white"
                          >
                            {selectedNFT.name}
                          </Dialog.Title>
                          <button
                            onClick={() => setSelectedNFT(null)}
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                          >
                            <svg
                              className="w-6 h-6"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>

                        {selectedNFT.imageUrl && (
                          <div className="mb-4 rounded-xl overflow-hidden">
                            <img
                              src={selectedNFT.imageUrl}
                              alt={selectedNFT.name}
                              className="w-full h-auto"
                            />
                          </div>
                        )}

                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Collection</p>
                            <p className="text-base font-medium text-gray-900 dark:text-white">
                              {selectedNFT.collectionName}
                            </p>
                          </div>

                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Token ID</p>
                            <p className="text-base font-mono text-gray-900 dark:text-white">
                              {selectedNFT.tokenId}
                            </p>
                          </div>

                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Contract</p>
                            <p className="text-base font-mono text-gray-900 dark:text-white break-all">
                              {selectedNFT.contractAddress}
                            </p>
                          </div>

                          {selectedNFT.description && (
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Description
                              </p>
                              <p className="text-base text-gray-900 dark:text-white">
                                {selectedNFT.description}
                              </p>
                            </div>
                          )}

                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Standard</p>
                            <p className="text-base text-gray-900 dark:text-white">
                              {selectedNFT.standard}
                            </p>
                          </div>

                          {selectedNFT.metadata?.attributes &&
                            selectedNFT.metadata.attributes.length > 0 && (
                              <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                  Attributes
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  {selectedNFT.metadata.attributes.map((attr, index) => (
                                    <div
                                      key={index}
                                      className="bg-gray-100 dark:bg-gray-700 rounded-lg p-2"
                                    >
                                      <p className="text-xs text-gray-600 dark:text-gray-400">
                                        {attr.trait_type}
                                      </p>
                                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                                        {attr.value}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                        </div>
                      </>
                    )}
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    </Layout>
  );
}
