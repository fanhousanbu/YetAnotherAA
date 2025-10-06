import React, { Fragment } from "react";
import { Dialog, Transition } from "@headlessui/react";
import QRCode from "react-qr-code";
import CopyButton from "./CopyButton";
import { XMarkIcon, QrCodeIcon } from "@heroicons/react/24/outline";

interface ReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
}

export default function ReceiveModal({ isOpen, onClose, address }: ReceiveModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-2xl transition-all border border-gray-200 dark:border-gray-700">
                <Dialog.Title as="div" className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <QrCodeIcon className="w-6 h-6 text-slate-900 dark:text-emerald-400 mr-2" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Receive Funds
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center w-8 h-8 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    onClick={onClose}
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </Dialog.Title>

                <div className="mt-6">
                  {/* QR Code Container */}
                  <div className="flex justify-center mb-6">
                    <div className="p-4 bg-white rounded-xl shadow-inner border-2 border-gray-200 dark:border-gray-600">
                      <QRCode
                        value={address}
                        size={200}
                        level="M"
                        bgColor="#ffffff"
                        fgColor="#000000"
                      />
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-gray-600 dark:text-gray-400 text-center">
                      Scan this QR code or copy the address below to receive ETH and tokens
                    </p>
                  </div>

                  {/* Address Display */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Your Smart Account Address:
                    </label>
                    <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700">
                      <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate">
                          {address}
                        </p>
                      </div>
                      <CopyButton text={address} className="flex-shrink-0" showToast={true} />
                    </div>
                  </div>

                  {/* Info Note */}
                  <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      💡 This is your ERC-4337 smart account address. You can receive ETH and any
                      ERC-20 tokens directly to this address.
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <div className="mt-6">
                  <button
                    type="button"
                    className="w-full inline-flex justify-center items-center px-4 py-2.5 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 border border-transparent rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:focus:ring-emerald-500 transition-all"
                    onClick={onClose}
                  >
                    Done
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
