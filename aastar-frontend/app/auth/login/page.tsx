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
      await authAPI.completeDevicePasskeyRegistration({
        email: deviceFormData.email,
        password: deviceFormData.password,
        credential,
      });

      toast.dismiss(loadingToast);
      toast.success("Passkey registered for this device! You can now login with passkey.");
      setShowDeviceRegister(false);
      setDeviceFormData({ email: "", password: "" });
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {!showDeviceRegister ? (
            <>
              <div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                  Sign in with Passkey
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                  Or{" "}
                  <Link
                    href="/auth/register"
                    className="font-medium text-blue-600 hover:text-blue-500"
                  >
                    create a new account
                  </Link>
                </p>
                <p className="mt-1 text-center text-xs text-gray-500">
                  Login requires only your passkey
                </p>
              </div>

              <div className="mt-8 space-y-6">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-blue-400"
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
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">Passkey Authentication</h3>
                      <div className="mt-1 text-sm text-blue-700">
                        <p>
                          Click the button below to authenticate using your device&apos;s passkey
                          (Face ID, Touch ID, Windows Hello, etc.).
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    onClick={handlePasskeyLogin}
                    disabled={loading}
                    className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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

                <div className="text-center">
                  <button
                    onClick={() => setShowDeviceRegister(true)}
                    className="text-sm text-gray-600 hover:text-gray-900 underline"
                  >
                    New device? Register passkey for this device
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                  Register Passkey for This Device
                </h2>
                <p className="mt-2 text-center text-sm text-gray-600">
                  Enter your email and password to register a passkey for this device
                </p>
                <div className="text-center mt-2">
                  <button
                    onClick={() => setShowDeviceRegister(false)}
                    className="text-sm text-blue-600 hover:text-blue-500 underline"
                  >
                    ← Back to passkey login
                  </button>
                </div>
              </div>

              <form className="mt-8 space-y-6" onSubmit={handleDevicePasskeyRegister}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
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
                      className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                      placeholder="Enter your email"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
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
                      className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                      placeholder="Enter your password"
                    />
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-yellow-400"
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
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">Device Registration</h3>
                      <div className="mt-1 text-sm text-yellow-700">
                        <p>
                          This will register a new passkey specifically for this device. You&apos;ll
                          need your existing credentials to verify your identity.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Registering passkey...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
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
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
