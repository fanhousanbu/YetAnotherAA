"use client";

/**
 * Guardian Sign Page
 *
 * Mobile-optimized page for guardian devices to sign an acceptance hash.
 * Accessed via QR code scan. URL params:
 *   - acceptanceHash: the raw keccak256 hash to sign
 *   - factory: factory contract address
 *   - chainId: numeric chain ID
 *   - owner: future account owner address
 *   - salt: numeric salt
 *
 * Signing flow:
 *   1. Guardian enters their wallet address (KMS key address)
 *   2. KMS BeginAuthentication → browser WebAuthn ceremony
 *   3. KMS SignHash (EIP-191 prefixed hash) → returns Signature
 *   4. Page displays guardian address + signature for user to copy/paste
 */

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { startAuthentication } from "@simplewebauthn/browser";
import { kmsClient } from "@/lib/yaaa";
import { ethers } from "ethers";

// ── Helper: apply EIP-191 prefix ──────────────────────────────────────────
// Replicates: ethers.hashMessage(ethers.getBytes(hash))
// Signs the EIP-191 prefixed version of the 32-byte acceptance hash.
function applyEip191(rawHash: string): string {
  return ethers.hashMessage(ethers.getBytes(rawHash));
}

// ── Copy to clipboard helper ──
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ── Inner component (uses useSearchParams, must be inside Suspense) ──
function GuardianSignInner() {
  const searchParams = useSearchParams();

  const acceptanceHash = searchParams.get("acceptanceHash") || "";
  const factory = searchParams.get("factory") || "";
  const chainId = searchParams.get("chainId") || "";
  const owner = searchParams.get("owner") || "";
  const salt = searchParams.get("salt") || "";

  const [guardianAddress, setGuardianAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ address: string; signature: string } | null>(null);
  const [copied, setCopied] = useState<"address" | "sig" | "both" | null>(null);

  const isValidParams = acceptanceHash && factory && chainId && owner && salt;

  const handleSign = async () => {
    setError("");

    if (!guardianAddress) {
      setError("Please enter your guardian wallet address");
      return;
    }
    if (!/^0x[0-9a-fA-F]{40}$/.test(guardianAddress)) {
      setError("Not a valid Ethereum address");
      return;
    }
    if (!acceptanceHash) {
      setError("Missing acceptance hash in URL");
      return;
    }

    setLoading(true);
    try {
      // Step 1: Begin WebAuthn authentication ceremony via KMS
      const authResponse = await kmsClient.beginAuthentication({
        Address: guardianAddress,
      });

      // Step 2: Browser WebAuthn ceremony
      const credential = await startAuthentication({ optionsJSON: authResponse.Options as any });

      // Step 3: Apply EIP-191 prefix to the acceptance hash before signing
      const hashToSign = applyEip191(acceptanceHash);

      // Step 4: Sign hash via KMS with WebAuthn credential
      const signResponse = await kmsClient.signHashWithWebAuthn(
        hashToSign,
        authResponse.ChallengeId,
        credential,
        { Address: guardianAddress }
      );

      setResult({
        address: guardianAddress,
        signature: signResponse.Signature?.startsWith("0x")
          ? signResponse.Signature
          : "0x" + signResponse.Signature,
      });
    } catch (err: any) {
      console.error("Guardian sign error:", err);
      if (err.name === "NotAllowedError") {
        setError("Authentication was cancelled or not allowed. Please try again.");
      } else if (err.name === "NotSupportedError") {
        setError("Passkeys are not supported on this device.");
      } else if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else if (err.message) {
        setError(err.message);
      } else {
        setError("Signing failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (field: "address" | "sig" | "both") => {
    if (!result) return;
    let text = "";
    if (field === "address") text = result.address;
    else if (field === "sig") text = result.signature;
    else text = `Address: ${result.address}\nSignature: ${result.signature}`;

    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  if (!isValidParams) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-md w-full">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Invalid QR Code
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              This page must be opened by scanning a valid Guardian QR code. Please ask the account
              owner to regenerate the QR code.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 max-w-md w-full space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 dark:bg-slate-800 mb-3 shadow-lg">
            <svg
              className="w-7 h-7 text-emerald-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Guardian Sign</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Sign as a guardian for an AirAccount
          </p>
        </div>

        {/* Account details */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Chain ID</span>
            <span className="text-gray-900 dark:text-white font-mono">{chainId}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Owner</span>
            <span className="text-gray-900 dark:text-white font-mono truncate ml-4 max-w-[200px]">
              {owner}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Factory</span>
            <span className="text-gray-900 dark:text-white font-mono truncate ml-4 max-w-[200px]">
              {factory}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400 font-medium">Salt</span>
            <span className="text-gray-900 dark:text-white font-mono">{salt}</span>
          </div>
          <div className="pt-1 border-t border-gray-200 dark:border-gray-700">
            <p className="text-gray-500 dark:text-gray-400 font-medium mb-1">Acceptance Hash</p>
            <p className="text-gray-900 dark:text-white font-mono break-all text-xs">
              {acceptanceHash}
            </p>
          </div>
        </div>

        {!result ? (
          <>
            {/* Guardian address input */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Your Guardian Wallet Address
              </label>
              <input
                type="text"
                value={guardianAddress}
                onChange={e => setGuardianAddress(e.target.value.trim())}
                placeholder="0x..."
                disabled={loading}
                className="block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Enter the Ethereum address associated with your passkey on this device.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 p-3">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* Sign button */}
            <button
              type="button"
              onClick={handleSign}
              disabled={loading}
              className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent text-base font-semibold rounded-xl text-white bg-emerald-600 hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Authenticating...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Sign with Passkey
                </>
              )}
            </button>
          </>
        ) : (
          /* Signature result */
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
            <p className="text-center text-sm font-semibold text-green-700 dark:text-green-400">
              Signature complete! Copy the values below and paste them into the desktop app.
            </p>

            {/* Address */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-900/50 p-4 space-y-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Your Address
                </span>
                <button
                  onClick={() => handleCopy("address")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {copied === "address" ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="font-mono text-sm text-gray-900 dark:text-white break-all">
                {result.address}
              </p>
            </div>

            {/* Signature */}
            <div className="rounded-xl bg-gray-50 dark:bg-gray-900/50 p-4 space-y-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Signature
                </span>
                <button
                  onClick={() => handleCopy("sig")}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {copied === "sig" ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="font-mono text-xs text-gray-900 dark:text-white break-all">
                {result.signature}
              </p>
            </div>

            {/* Copy all button */}
            <button
              type="button"
              onClick={() => handleCopy("both")}
              className="w-full py-2.5 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {copied === "both" ? "Copied!" : "Copy Address + Signature"}
            </button>
          </div>
        )}

        {/* Info footer */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
            Signing with EIP-191. Your passkey never leaves this device.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Page export wrapped in Suspense (required for useSearchParams) ──
export default function GuardianSignPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
          <div className="w-10 h-10 border-b-2 border-emerald-500 rounded-full animate-spin" />
        </div>
      }
    >
      <GuardianSignInner />
    </Suspense>
  );
}
