"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Layout from "@/components/Layout";
import { authAPI } from "@/lib/api";
import { setStoredAuth } from "@/lib/auth";
import toast from "react-hot-toast";
import { startRegistration } from "@simplewebauthn/browser";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!formData.email) {
      toast.error("Please enter your email address");
      return;
    }

    if (!formData.password) {
      toast.error("Please enter a password");
      return;
    }

    if (formData.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    let loadingToast: string | null = null;

    try {
      // 第一步：开始Passkey注册
      loadingToast = toast.loading("Starting passkey registration...");
      const beginResponse = await authAPI.beginPasskeyRegistration({
        email: formData.email,
        username: formData.username || undefined,
        password: formData.password,
      });

      const { options } = beginResponse.data;

      // 第二步：调用WebAuthn API
      toast.dismiss(loadingToast);
      loadingToast = toast.loading("Please complete the passkey setup with your authenticator...");
      const credential = await startRegistration(options);

      // 第三步：完成注册
      toast.dismiss(loadingToast);
      loadingToast = toast.loading("Completing registration...");
      const completeResponse = await authAPI.completePasskeyRegistration({
        email: formData.email,
        username: formData.username || undefined,
        password: formData.password,
        credential,
      });

      const { access_token, user } = completeResponse.data;

      toast.dismiss(loadingToast);
      setStoredAuth(access_token, user);
      toast.success("Account created successfully with passkey!");
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Passkey registration error:", error);
      let message = "Passkey registration failed";

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <Layout>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
              Create your account with Passkey
            </h2>
            <p className="mt-2 text-center text-sm text-gray-700 dark:text-gray-300">
              Or{" "}
<<<<<<< HEAD
              <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
=======
              <Link
                href="/auth/login"
                className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
>>>>>>> origin/master
                sign in to your existing account
              </Link>
            </p>
            <p className="mt-1 text-center text-xs text-gray-600 dark:text-gray-400">
              Registration requires email, password, and passkey setup
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
<<<<<<< HEAD
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
=======
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
>>>>>>> origin/master
                  Email address *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-600 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your email"
                />
              </div>

              <div>
<<<<<<< HEAD
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
=======
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
>>>>>>> origin/master
                  Username (optional)
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={formData.username}
                  onChange={handleChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-600 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your username"
                />
              </div>

              <div>
<<<<<<< HEAD
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
=======
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
>>>>>>> origin/master
                  Password *
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-600 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Enter your password (min 6 characters)"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Confirm Password *
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-600 dark:placeholder-gray-400 text-gray-900 dark:text-white bg-white dark:bg-gray-800 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Confirm your password"
                />
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
<<<<<<< HEAD
                    <svg className="h-5 w-5 text-blue-400 dark:text-blue-300" fill="currentColor" viewBox="0 0 20 20">
=======
                    <svg
                      className="h-5 w-5 text-blue-400 dark:text-blue-300"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
>>>>>>> origin/master
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
<<<<<<< HEAD
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">Passkey Registration</h3>
=======
                    <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Passkey Registration
                    </h3>
>>>>>>> origin/master
                    <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                      <p>
                        You&apos;ll set up both a password (for new device access) and a passkey
                        (for secure login). After clicking &quot;Create Account&quot;, you&apos;ll
                        be prompted to set up a passkey using your device&apos;s authenticator.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Setting up passkey...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <svg className="h-4 w-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Create Account with Passkey
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
