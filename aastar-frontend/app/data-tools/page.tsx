"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  KeyIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export default function DataToolsPage() {
  const [password, setPassword] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleExport = async () => {
    if (!password.trim()) {
      toast.error("Please enter password");
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/data-tools/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Export failed");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aastar-data-${Date.now()}.tar.gz`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Data exported successfully!");
      setPassword("");
    } catch (error: any) {
      toast.error(error.message || "Failed to export data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!password.trim()) {
      toast.error("Please enter password");
      return;
    }

    if (!importFile) {
      toast.error("Please select a file to import");
      return;
    }

    setIsImporting(true);
    try {
      // Convert file to base64
      const arrayBuffer = await importFile.arrayBuffer();
      const base64Data = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );

      const response = await fetch(`${API_BASE_URL}/data-tools/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password,
          data: base64Data,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Import failed");
      }

      toast.success("Data imported successfully! Please restart the server.");
      setPassword("");
      setImportFile(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to import data");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      <div className="px-4 py-8 mx-auto max-w-4xl sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-900 dark:bg-emerald-600 mb-4">
            <ShieldCheckIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Data Management Tools
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Export and import persistent data securely
          </p>
        </div>

        {/* Warning Notice */}
        <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
          <div className="flex items-start">
            <KeyIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                Important Security Notice
              </h3>
              <p className="text-xs text-yellow-800 dark:text-yellow-300">
                This tool requires administrator password. The exported data contains sensitive
                information. Please store it securely. After importing data, you must restart the
                backend server for changes to take effect.
              </p>
            </div>
          </div>
        </div>

        {/* Password Input */}
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Administrator Password
          </label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Export Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <ArrowDownTrayIcon className="w-6 h-6 text-slate-900 dark:text-emerald-400" />
              </div>
              <h2 className="ml-3 text-xl font-semibold text-gray-900 dark:text-white">
                Export Data
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Download all persistent data as a compressed archive file. This includes user
              accounts, transfers, paymasters, tokens, and all other data stored in the system.
            </p>
            <button
              onClick={handleExport}
              disabled={isExporting || !password.trim()}
              className="w-full inline-flex items-center justify-center px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 border border-transparent rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:focus:ring-emerald-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isExporting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <ArrowDownTrayIcon className="w-5 h-5 mr-2" />
                  Export Data
                </>
              )}
            </button>
          </div>

          {/* Import Section */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                <ArrowUpTrayIcon className="w-6 h-6 text-slate-900 dark:text-emerald-400" />
              </div>
              <h2 className="ml-3 text-xl font-semibold text-gray-900 dark:text-white">
                Import Data
              </h2>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Upload a previously exported data archive to restore the system state. This will
              replace all existing data.
            </p>

            {/* File Input */}
            <div className="mb-4">
              <label
                htmlFor="file-upload"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Select File
              </label>
              <input
                id="file-upload"
                type="file"
                accept="application/gzip,application/x-gzip,application/x-tar,application/x-compressed-tar,.gz,.tar.gz,.tgz"
                onChange={e => {
                  const file = e.target.files?.[0] || null;
                  console.log("File selected:", file?.name, file?.type);
                  setImportFile(file);
                }}
                className="block w-full text-sm text-gray-900 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 focus:outline-none file:mr-4 file:py-2 file:px-4 file:rounded-l-lg file:border-0 file:text-sm file:font-semibold file:bg-slate-900 dark:file:bg-emerald-600 file:text-white hover:file:bg-slate-800 dark:hover:file:bg-emerald-500 file:cursor-pointer"
              />
              {importFile && (
                <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                  Selected: {importFile.name}
                </p>
              )}
            </div>

            <button
              onClick={handleImport}
              disabled={isImporting || !password.trim() || !importFile}
              className="w-full inline-flex items-center justify-center px-4 py-3 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 border border-transparent rounded-xl shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:focus:ring-emerald-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isImporting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Importing...
                </>
              ) : (
                <>
                  <ArrowUpTrayIcon className="w-5 h-5 mr-2" />
                  Import Data
                </>
              )}
            </button>
            {importFile && (
              <p className="mt-3 text-xs text-red-600 dark:text-red-400 font-semibold">
                ⚠️ Warning: This will replace all existing data!
              </p>
            )}
          </div>
        </div>

        {/* Back to Dashboard */}
        <div className="mt-8 text-center">
          <a
            href="/dashboard"
            className="inline-flex items-center text-sm font-medium text-slate-900 dark:text-emerald-400 hover:text-slate-700 dark:hover:text-emerald-300 transition-colors"
          >
            ← Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
