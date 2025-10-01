"use client";

import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import EntryPointVersionSelector from "./EntryPointVersionSelector";
import { EntryPointVersion } from "@/lib/types";
import { accountAPI } from "@/lib/api";
import toast from "react-hot-toast";

interface CreateAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (account: any) => void;
}

export default function CreateAccountDialog({
  isOpen,
  onClose,
  onSuccess,
}: CreateAccountDialogProps) {
  const [version, setVersion] = useState<EntryPointVersion>(EntryPointVersion.V0_7);
  const [salt, setSalt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const response = await accountAPI.create({
        entryPointVersion: version,
        salt: salt ? parseInt(salt) : undefined,
        deploy: false, // Will be deployed on first transaction
      });

      toast.success(`Smart Account created with EntryPoint ${version}!`);
      onSuccess(response.data);
      onClose();
    } catch (error: any) {
      const message = error.response?.data?.message || "Failed to create account";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white dark:bg-gray-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="absolute right-0 top-0 pr-4 pt-4">
                  <button
                    type="button"
                    className="rounded-md bg-white dark:bg-gray-800 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    onClick={onClose}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>
                </div>

                <div>
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-semibold leading-6 text-gray-900 dark:text-white mb-4"
                  >
                    Create Smart Account
                  </Dialog.Title>

                  <div className="space-y-4">
                    <EntryPointVersionSelector
                      value={version}
                      onChange={setVersion}
                      disabled={loading}
                    />

                    <div>
                      <button
                        type="button"
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400"
                      >
                        {showAdvanced ? "Hide" : "Show"} Advanced Options
                      </button>
                    </div>

                    {showAdvanced && (
                      <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <div>
                          <label
                            htmlFor="salt"
                            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                          >
                            Salt (Optional)
                          </label>
                          <input
                            type="number"
                            id="salt"
                            value={salt}
                            onChange={e => setSalt(e.target.value)}
                            placeholder="Leave empty for random salt"
                            disabled={loading}
                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
                          />
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Salt is used for deterministic address generation
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 sm:flex sm:flex-row-reverse gap-3">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={loading}
                    className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-b-2 border-white rounded-full animate-spin"></div>
                        Creating...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white dark:bg-gray-700 px-3 py-2 text-sm font-semibold text-gray-900 dark:text-gray-300 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed sm:mt-0 sm:w-auto"
                  >
                    Cancel
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
