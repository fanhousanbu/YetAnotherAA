"use client";

import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { addressBookAPI } from "@/lib/api";
import toast from "react-hot-toast";
import { TrashIcon, PencilIcon, PlusIcon, BookOpenIcon } from "@heroicons/react/24/outline";

interface AddressBookEntry {
  address: string;
  name?: string;
  usageCount: number;
  firstUsed: string;
  lastUsed: string;
  transactionHashes: string[];
}

export default function AddressBookPage() {
  const [addressBook, setAddressBook] = useState<AddressBookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [newName, setNewName] = useState("");

  useEffect(() => {
    loadAddressBook();
  }, []);

  const loadAddressBook = async () => {
    setLoading(true);
    try {
      const response = await addressBookAPI.getAddressBook();
      setAddressBook(response.data);
    } catch (error) {
      console.error("Failed to load address book:", error);
      toast.error("Failed to load address book");
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = async () => {
    if (!newAddress) {
      toast.error("Please enter an address");
      return;
    }

    // Validate address format
    if (!newAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast.error("Invalid address format");
      return;
    }

    try {
      await addressBookAPI.setAddressName(newAddress, newName || "");
      await loadAddressBook();
      setShowAddForm(false);
      setNewAddress("");
      setNewName("");
      toast.success("Address added successfully! 📖");
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to add address";
      toast.error(message);
    }
  };

  const handleUpdateName = async (address: string) => {
    try {
      await addressBookAPI.setAddressName(address, editingName);
      await loadAddressBook();
      setEditingAddress(null);
      setEditingName("");
      toast.success("Name updated successfully!");
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to update name";
      toast.error(message);
    }
  };

  const handleDeleteAddress = async (address: string) => {
    if (!confirm("Are you sure you want to delete this address?")) {
      return;
    }

    try {
      await addressBookAPI.removeAddress(address);
      await loadAddressBook();
      toast.success("Address deleted successfully!");
    } catch (error) {
      const message = (error as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to delete address";
      toast.error(message);
    }
  };

  const startEdit = (entry: AddressBookEntry) => {
    setEditingAddress(entry.address);
    setEditingName(entry.name || "");
  };

  if (loading) {
    return (
      <Layout requireAuth={true}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-32 h-32 border-b-2 border-slate-900 dark:border-emerald-500 rounded-full animate-spin"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout requireAuth={true}>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pb-24 pt-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center min-w-0 flex-1">
                <BookOpenIcon className="w-10 h-10 text-blue-600 dark:text-blue-400 mr-3 flex-shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                    Address Book
                  </h1>
                  <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
                    Manage your saved addresses
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex items-center px-3 sm:px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all whitespace-nowrap flex-shrink-0"
              >
                <PlusIcon className="w-5 h-5 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Add Address</span>
                <span className="inline sm:hidden">Add</span>
              </button>
            </div>
          </div>

          {/* Add Address Form */}
          {showAddForm && (
            <div className="mb-6 p-6 bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-600 rounded-2xl shadow-lg">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Add New Address
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Address
                  </label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={e => setNewAddress(e.target.value)}
                    placeholder="0x..."
                    className="block w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 text-sm placeholder-gray-400 dark:placeholder-gray-500 transition-all font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g., Alice's Wallet"
                    className="block w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 text-sm placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleAddAddress}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    Add Address
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewAddress("");
                      setNewName("");
                    }}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Address List */}
          {addressBook.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
              <BookOpenIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No saved addresses
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Add addresses to quickly access them during transfers
              </p>
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              >
                <PlusIcon className="w-5 h-5 mr-2" />
                Add Your First Address
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {addressBook.map(entry => (
                <div
                  key={entry.address}
                  className="p-6 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg hover:shadow-xl transition-all"
                >
                  {editingAddress === entry.address ? (
                    // Edit mode
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Name
                        </label>
                        <input
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          placeholder="Enter name"
                          className="block w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-blue-500 dark:focus:border-blue-400 text-sm placeholder-gray-400 dark:placeholder-gray-500 transition-all"
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleUpdateName(entry.address)}
                          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-green-600 dark:bg-green-500 rounded-xl hover:bg-green-700 dark:hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setEditingAddress(null);
                            setEditingName("");
                          }}
                          className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View mode
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        {entry.name && (
                          <div className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                            {entry.name}
                          </div>
                        )}
                        <div className="text-sm font-mono text-gray-600 dark:text-gray-400 break-all">
                          {entry.address}
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          {entry.usageCount > 0 ? (
                            <>
                              <span>Used {entry.usageCount} times</span>
                              {entry.firstUsed && (
                                <span>
                                  First used{" "}
                                  {new Date(entry.firstUsed).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                              )}
                            </>
                          ) : (
                            entry.firstUsed && (
                              <span>
                                Added{" "}
                                {new Date(entry.firstUsed).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => startEdit(entry)}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                          title="Edit name"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteAddress(entry.address)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
                          title="Delete address"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
