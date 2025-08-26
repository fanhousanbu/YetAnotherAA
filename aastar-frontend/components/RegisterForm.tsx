"use client";

import { useState } from "react";
import { startRegistration } from "@simplewebauthn/browser";
import { api, ApiError } from "../lib/api";
import { User } from "../lib/types";
import type { RegistrationResponseJSON } from "@simplewebauthn/types";

interface RegisterFormProps {
  onRegister?: (user: User) => void;
  onSwitchToLogin?: () => void;
}

export default function RegisterForm({ onRegister, onSwitchToLogin }: RegisterFormProps) {
  const [email, setEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<"email" | "verification" | "passkey">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const handleSendVerificationCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("请输入邮箱地址");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.auth.sendVerificationCode(email);
      setStep("verification");
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error("发送验证码失败:", error);
      if (error instanceof ApiError) {
        setError(error.message);
      } else {
        setError("发送验证码失败，请重试");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode) {
      setError("请输入验证码");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.auth.verifyEmail(email, verificationCode);
      setStep("passkey");
    } catch (error) {
      console.error("验证码验证失败:", error);
      if (error instanceof ApiError) {
        setError(error.message);
      } else {
        setError("验证码验证失败，请重试");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyRegistration = async () => {
    setLoading(true);
    setError("");

    try {
      console.log("开始 Passkey 注册流程...");

      // 1. 获取注册选项
      const options = await api.auth.registerBegin(email, verificationCode);
      console.log("注册选项获取成功:", options);

      // 2. 创建 Passkey 凭证
      let credential: RegistrationResponseJSON;
      try {
        console.log("开始 WebAuthn 注册...");

        credential = await startRegistration({
          optionsJSON: options,
        });
        console.log("WebAuthn 注册成功:", credential);
      } catch (err: any) {
        console.error("WebAuthn 注册错误:", err);

        if (err?.name === "NotAllowedError") {
          throw new Error("用户取消了 Passkey 创建或操作超时");
        } else if (err?.name === "InvalidStateError") {
          throw new Error("该邮箱已经注册过 Passkey，请尝试登录");
        } else if (err?.name === "NotSupportedError") {
          throw new Error("您的设备或浏览器不支持 Passkey 功能");
        } else if (err?.name === "SecurityError") {
          throw new Error("安全错误：请确保在安全的 HTTPS 环境下使用");
        } else {
          throw new Error(`创建 Passkey 失败: ${err?.message || "未知错误"}`);
        }
      }

      // 3. 完成注册
      console.log("完成注册...");
      const result = await api.auth.registerComplete(options.challenge, credential);

      if (result.success) {
        // 保存访问令牌
        localStorage.setItem("accessToken", result.accessToken);

        setSuccess(true);
        console.log("注册成功:", result);

        if (onRegister) {
          // 获取用户信息
          const user = await api.user.getCurrentUser();
          onRegister(user);
        }
      } else {
        throw new Error(result.message || "注册失败");
      }
    } catch (err) {
      console.error("注册错误:", err);
      setError(err instanceof Error ? err.message : "注册失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const resendVerificationCode = async () => {
    if (countdown > 0) return;

    setLoading(true);
    setError("");

    try {
      await api.auth.sendVerificationCode(email);
      setCountdown(60);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error) {
      console.error("重新发送验证码失败:", error);
      if (error instanceof ApiError) {
        setError(error.message);
      } else {
        setError("重新发送验证码失败，请重试");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">注册账户</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            使用邮箱验证和 Passkey 注册新账户
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">注册成功！</h3>
              </div>
            </div>
          </div>
        )}

        {/* 步骤指示器 */}
        <div className="flex items-center justify-center space-x-4">
          <div
            className={`flex items-center ${step === "email" ? "text-blue-600" : step === "verification" ? "text-blue-600" : "text-green-600"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === "email"
                  ? "bg-blue-600 text-white"
                  : step === "verification"
                    ? "bg-blue-600 text-white"
                    : "bg-green-600 text-white"
              }`}
            >
              1
            </div>
            <span className="ml-2 text-sm">邮箱</span>
          </div>
          <div
            className={`w-8 h-0.5 ${step === "verification" || step === "passkey" ? "bg-blue-600" : "bg-gray-300"}`}
          ></div>
          <div
            className={`flex items-center ${step === "verification" ? "text-blue-600" : step === "passkey" ? "text-green-600" : "text-gray-400"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === "verification"
                  ? "bg-blue-600 text-white"
                  : step === "passkey"
                    ? "bg-green-600 text-white"
                    : "bg-gray-300 text-gray-500"
              }`}
            >
              2
            </div>
            <span className="ml-2 text-sm">验证</span>
          </div>
          <div className={`w-8 h-0.5 ${step === "passkey" ? "bg-green-600" : "bg-gray-300"}`}></div>
          <div
            className={`flex items-center ${step === "passkey" ? "text-green-600" : "text-gray-400"}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === "passkey" ? "bg-green-600 text-white" : "bg-gray-300 text-gray-500"
              }`}
            >
              3
            </div>
            <span className="ml-2 text-sm">Passkey</span>
          </div>
        </div>

        {/* 步骤 1: 邮箱输入 */}
        {step === "email" && (
          <form className="mt-8 space-y-6" onSubmit={handleSendVerificationCode}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                邮箱地址
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="请输入邮箱地址"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                  loading
                    ? "bg-indigo-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                }`}
              >
                {loading ? (
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
                    发送验证码中...
                  </>
                ) : (
                  "发送验证码"
                )}
              </button>
            </div>
          </form>
        )}

        {/* 步骤 2: 验证码验证 */}
        {step === "verification" && (
          <form className="mt-8 space-y-6" onSubmit={handleVerifyCode}>
            <div>
              <label
                htmlFor="verificationCode"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                验证码
              </label>
              <input
                id="verificationCode"
                name="verificationCode"
                type="text"
                required
                maxLength={6}
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="请输入6位验证码"
                value={verificationCode}
                onChange={e => setVerificationCode(e.target.value)}
                disabled={loading}
              />
              <p className="mt-1 text-sm text-gray-500">验证码已发送至 {email}</p>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setStep("email")}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                返回
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
              >
                {loading ? "验证中..." : "验证"}
              </button>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={resendVerificationCode}
                disabled={countdown > 0 || loading}
                className="text-sm text-indigo-600 hover:text-indigo-500 disabled:text-gray-400"
              >
                {countdown > 0 ? `${countdown}秒后重新发送` : "重新发送验证码"}
              </button>
            </div>
          </form>
        )}

        {/* 步骤 3: Passkey 注册 */}
        {step === "passkey" && (
          <div className="mt-8 space-y-6">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">邮箱验证成功！现在请创建您的 Passkey</p>
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={() => setStep("verification")}
                className="flex-1 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                返回
              </button>
              <button
                onClick={handlePasskeyRegistration}
                disabled={loading}
                className="flex-1 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400"
              >
                {loading ? (
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
                    创建 Passkey 中...
                  </>
                ) : (
                  "创建 Passkey"
                )}
              </button>
            </div>
          </div>
        )}

        {onSwitchToLogin && (
          <div className="text-center">
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-sm text-indigo-600 hover:text-indigo-500"
            >
              已有账号？点击登录
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
