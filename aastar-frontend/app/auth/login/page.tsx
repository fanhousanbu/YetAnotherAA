"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Layout from "@/components/Layout";
import { authAPI } from "@/lib/api";
import { setStoredAuth } from "@/lib/auth";
import toast from "react-hot-toast";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [showDeviceRegister, setShowDeviceRegister] = useState(false);
  const [deviceFormData, setDeviceFormData] = useState({
    email: "",
    password: "",
  });
  const router = useRouter();

  const handlePasskeyLogin = async () => {
    if (loading) return;

    setLoading(true);
    let loadingToast: string | null = null;

    try {
      // 第一步：开始Passkey登录
      loadingToast = toast.loading("Starting passkey authentication...");
      const beginResponse = await authAPI.beginPasskeyLogin();
      const options = beginResponse.data;

      // 第二步：调用WebAuthn API
      toast.dismiss(loadingToast);
      loadingToast = toast.loading("Please authenticate with your passkey...");
      const credential = await startAuthentication(options);

      // 第三步：完成登录
      toast.dismiss(loadingToast);
      loadingToast = toast.loading("Completing authentication...");
      const completeResponse = await authAPI.completePasskeyLogin({
        credential,
      });

      const { access_token, user } = completeResponse.data;

      toast.dismiss(loadingToast);
      setStoredAuth(access_token, user);
      toast.success("Login successful!");
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Passkey login error:", error);
      let message = "Passkey authentication failed";

      if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.name === "NotAllowedError") {
        message = "Authentication was cancelled or not allowed";
      } else if (error.name === "NotSupportedError") {
        message = "Passkeys are not supported on this device";
      } else if (error.name === "SecurityError") {
        message = "Security error during authentication";
      }

      if (message.includes("Passkey not found")) {
        toast.error("No passkey found. You may need to register a passkey for this device.");
        setShowDeviceRegister(true);
      } else {
        if (loadingToast) {
          toast.dismiss(loadingToast);
        }
        toast.error(message);
      }
    } finally {
      setLoading(false);
      if (loadingToast) {
        toast.dismiss(loadingToast);
      }
    }
  };

  const handleDevicePasskeyRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!deviceFormData.email || !deviceFormData.password) {
      toast.error("Please enter your email and password");
      return;
    }

    setLoading(true);
    let loadingToast: string | null = null;

    try {
      // 第一步：开始新设备Passkey注册
      loadingToast = toast.loading("Verifying credentials...");
      const beginResponse = await authAPI.beginDevicePasskeyRegistration({
        email: deviceFormData.email,
        password: deviceFormData.password,
      });

      const options = beginResponse.data;

      // 第二步：调用WebAuthn API
      toast.dismiss(loadingToast);
      loadingToast = toast.loading("Please set up passkey for this device...");
      const credential = await startRegistration(options);

      // 第三步：完成注册
      toast.dismiss(loadingToast);
      loadingToast = toast.loading("Completing passkey setup...");
      const completeResponse = await authAPI.completeDevicePasskeyRegistration({
        email: deviceFormData.email,
        password: deviceFormData.password,
        credential,
      });

      const { access_token, user } = completeResponse.data;

      toast.dismiss(loadingToast);
      setStoredAuth(access_token, user);
      toast.success("Passkey registered and logged in successfully!");
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Device passkey registration error:", error);
      let message = "Device passkey registration failed";

      if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.name === "NotAllowedError") {
        message = "Passkey registration was cancelled or not allowed";
      } else if (error.name === "NotSupportedError") {
        message = "Passkeys are not supported on this device";
      } else if (error.name === "SecurityError") {
        message = "Security error during passkey registration";
      }

      if (loadingToast) {
        toast.dismiss(loadingToast);
      }
      toast.error(message);
    } finally {
      setLoading(false);
      if (loadingToast) {
        toast.dismiss(loadingToast);
      }
    }
  };

  const handleDeviceFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDeviceFormData({
      ...deviceFormData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full">
          {!showDeviceRegister ? (
            <>
              {/* Logo/Brand Section */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-900 dark:bg-slate-800 mb-4 shadow-lg">
                  <svg
                    className="w-8 h-8 text-emerald-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome Back</h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Sign in with your passkey for secure access
                </p>
              </div>

              {/* Main Card */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 space-y-6 border border-gray-200 dark:border-gray-700">
                {/* Info Box */}
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-6 w-6 text-slate-700 dark:text-slate-300"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="ml-3 flex-1">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        Passkey Authentication
                      </h3>
                      <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                        <p>
                          Use Face ID, Touch ID, Windows Hello, or your security key to sign in
                          securely.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sign In Button */}
                <div>
                  <button
                    onClick={handlePasskeyLogin}
                    disabled={loading}
                    className="group relative w-full flex justify-center py-3.5 px-4 border border-transparent text-base font-semibold rounded-xl text-white bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:focus:ring-emerald-500 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Authenticating...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Sign in with Passkey
                      </div>
                    )}
                  </button>
                </div>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200 dark:border-gray-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      Need help?
                    </span>
                  </div>
                </div>

                {/* New Device Link */}
                <div className="text-center">
                  <button
                    onClick={() => setShowDeviceRegister(true)}
                    className="inline-flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-emerald-400 transition-colors"
                  >
                    <svg
                      className="w-4 h-4 mr-1.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    New device? Register passkey for this device
                  </button>
                </div>
              </div>

              {/* Footer Links */}
              <div className="mt-6 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Don&apos;t have an account?{" "}
                  <Link
                    href="/auth/register"
                    className="font-semibold text-slate-900 hover:text-slate-700 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
                  >
                    Create a new account
                  </Link>
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Back Button */}
              <div className="mb-6">
                <button
                  onClick={() => setShowDeviceRegister(false)}
                  className="inline-flex items-center text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-slate-900 dark:hover:text-emerald-400 transition-colors"
                >
                  <svg
                    className="w-4 h-4 mr-1.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 19l-7-7m0 0l7-7m-7 7h18"
                    />
                  </svg>
                  Back to login
                </button>
              </div>

              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-orange-600 dark:bg-orange-500 mb-4 shadow-lg">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Register New Device
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Verify your credentials to add this device
                </p>
              </div>

              {/* Main Card */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
                <form className="space-y-5" onSubmit={handleDevicePasskeyRegister}>
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Email address
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      value={deviceFormData.email}
                      onChange={handleDeviceFormChange}
                      className="appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500 focus:border-transparent transition-all sm:text-sm"
                      placeholder="your.email@example.com"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="password"
                      className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2"
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      autoComplete="current-password"
                      required
                      value={deviceFormData.password}
                      onChange={handleDeviceFormChange}
                      className="appearance-none block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white bg-white dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-emerald-500 focus:border-transparent transition-all sm:text-sm"
                      placeholder="Enter your password"
                    />
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg
                          className="h-5 w-5 text-orange-700 dark:text-orange-300"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="ml-3 flex-1">
                        <h3 className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                          Device Registration
                        </h3>
                        <div className="mt-1 text-sm text-orange-800 dark:text-orange-200">
                          <p>Verify your identity to register a passkey for this device.</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-3.5 px-4 border border-transparent text-base font-semibold rounded-xl text-white bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-600 dark:focus:ring-orange-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                        Registering passkey...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Register Passkey for Device
                      </div>
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
