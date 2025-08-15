'use client';

import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { api } from '../lib/api';
import { User } from '../lib/types';
import type { RegistrationResponseJSON } from '@simplewebauthn/types';

interface RegisterFormProps {
  onRegister?: (user: User) => void;
  onSwitchToLogin?: () => void;
}

export default function RegisterForm({ onRegister, onSwitchToLogin }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      console.log('Starting registration for email:', email);
      
      // 1. 获取注册选项
      const { options } = await api.auth.registerStart(email);
      console.log('Registration options received:', options);

      // 2. 创建凭证
      let credential: RegistrationResponseJSON;
      try {
        console.log('Starting WebAuthn registration...');
        
        // 确保选项格式正确
        const registrationOptions = {
          ...options,
          // 确保 challenge 是字符串格式
          challenge: options.challenge,
          // 确保 user.id 是字符串格式
          user: {
            ...options.user,
            id: options.user.id
          },
          // 确保 excludeCredentials 格式正确
          excludeCredentials: options.excludeCredentials || []
        };

        console.log('Processed registration options:', registrationOptions);

        credential = await startRegistration({
          optionsJSON: registrationOptions
        });
        console.log('WebAuthn registration successful:', credential);
      } catch (err: any) {
        console.error('WebAuthn registration error:', err);
        console.error('Error name:', err?.name);
        console.error('Error message:', err?.message);
        console.error('Error stack:', err?.stack);
      
        // 更详细的错误信息
        if (err?.name === 'NotAllowedError') {
          throw new Error('用户取消了 Passkey 创建或操作超时');
        } else if (err?.name === 'InvalidStateError') {
          throw new Error('该邮箱已经注册过 Passkey，请尝试登录');
        } else if (err?.name === 'NotSupportedError') {
          throw new Error('您的设备或浏览器不支持 Passkey 功能');
        } else if (err?.name === 'SecurityError') {
          throw new Error('安全错误：请确保在安全的 HTTPS 环境下使用');
        } else if (err?.message?.includes('RESULT_CODE_KILLED_BAD_MESSAGE')) {
          throw new Error('Passkey 创建失败：数据格式错误，请重试');
        } else {
          throw new Error(`创建 Passkey 失败: ${err?.message || '未知错误'}`);
        }
      }

      // 3. 验证注册
      console.log('Completing registration...');
      
      const { user } = await api.auth.registerComplete({
        email,
        response: credential,
        challenge: options.challenge,
      });

      setSuccess(true);
      console.log('Registration successful:', user);
      
      if (onRegister) {
        // 转换 API 返回的用户数据为前端需要的 User 类型
        const frontendUser: User = {
          id: user.credentialId, // 使用 credentialId 作为用户 ID
          email: user.email,
          name: email.split('@')[0], // 使用邮箱前缀作为默认名称
          walletAddress: user.aaAddress,
          hasPasskey: true,
          createdAt: new Date().toISOString()
        };
        onRegister(frontendUser);
      }
      
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : '注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
    <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            注册账户
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            使用 Passkey 注册新账户
          </p>
        </div>
      
      {error && (
          <div className="rounded-md bg-red-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
          {error}
                </h3>
              </div>
            </div>
        </div>
      )}

      {success && (
          <div className="rounded-md bg-green-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">
                  注册成功！
                </h3>
              </div>
            </div>
        </div>
      )}

        <form className="mt-8 space-y-6" onSubmit={handleRegister}>
          <div className="rounded-md shadow-sm -space-y-px">
        <div>
              <label htmlFor="email" className="sr-only">
                邮箱地址
          </label>
            <input
                id="email"
                name="email"
                type="email"
              required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="邮箱地址"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
            />
          </div>
        </div>

        <div>
        <button
          type="submit"
          disabled={loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                loading
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              }`}
        >
          {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  注册中...
                </>
              ) : '使用 Passkey 注册'}
        </button>
          </div>

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
        </form>
      </div>
    </div>
  );
} 