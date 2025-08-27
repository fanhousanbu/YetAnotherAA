"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Layout from "@/components/Layout";
import { isAuthenticated } from "@/lib/auth";

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated()) {
      router.push("/dashboard");
    } else {
      setLoading(false);
    }
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-md w-full space-y-8 p-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to AAStar</h1>
            <p className="text-lg text-gray-600 mb-8">
              ERC-4337 Account Abstraction with BLS Aggregate Signatures
            </p>

            <div className="space-y-4">
              <button
                onClick={() => router.push("/auth/login")}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Sign In
              </button>

              <button
                onClick={() => router.push("/auth/register")}
                className="w-full flex justify-center py-3 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              >
                Create Account
              </button>
            </div>
          </div>

          <div className="mt-8 text-center">
            <div className="text-sm text-gray-500">
              <p className="mb-2">Features:</p>
              <ul className="space-y-1">
                <li>✨ ERC-4337 Smart Account</li>
                <li>🔐 BLS Signature Aggregation</li>
                <li>💸 Gasless Transactions</li>
                <li>📱 User-Friendly Interface</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
