'use client';

import { useState } from 'react';
import { User } from '@/lib/types';
import { verifyPasskeyCredential } from '@/lib/passkey';
import { api, ApiError } from '@/lib/api';
import { Key, Mail } from 'lucide-react';

interface LoginFormProps {
  onLogin: (user: User) => void;
  onSwitchToRegister: () => void;
}

export default function LoginForm({ onLogin, onSwitchToRegister }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showEmailRecovery, setShowEmailRecovery] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError('');
  };

  const handlePasskeyLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. 获取通用登录选项
      const { options } = await api.auth.loginStart('');

      // 2. 验证 passkey
      const credential = await verifyPasskeyCredential(options);

      // 3. 完成登录
      const { user } = await api.auth.loginComplete({
        credentialId: credential.id,
        response: credential,
        challenge: options.challenge,
      });

      // 4. 转换用户数据格式
      const frontendUser: User = {
        id: user.credentialId,
        email: user.email,
        name: user.email.split('@')[0],
        walletAddress: user.aaAddress,
        hasPasskey: true,
        createdAt: user.createdAt,
      };

      onLogin(frontendUser);
    } catch (error) {
      console.error('登录失败:', error);
      if (error instanceof ApiError) {
        if (error.status === 404) {
          setError('未找到 Passkey，请先注册或使用邮箱恢复账号');
        } else if (error.status === 401) {
          setError('Passkey 验证失败，请重试');
        } else {
          setError(error.message);
        }
      } else {
        setError('登录失败，请重试');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('请输入邮箱地址');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // TODO: 实现邮箱恢复功能
      setError('邮箱恢复功能尚未实现');
    } catch (error) {
      console.error('恢复失败:', error);
      setError('账号恢复失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-center mb-6">登录</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* 主要登录方式 - Passkey */}
      <div className="mb-8">
        <button
          onClick={handlePasskeyLogin}
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center py-4 text-lg"
        >
          {loading ? (
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
          ) : (
            <>
              <Key className="h-6 w-6 mr-3" />
              使用 Passkey 登录
            </>
          )}
        </button>
        <p className="text-sm text-gray-500 text-center mt-2">
          点击按钮，使用您的指纹、面容或设备密码登录
        </p>
      </div>

      {/* 分隔线 */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">遇到问题？</span>
        </div>
      </div>

      {/* 邮箱恢复选项 */}
      {!showEmailRecovery ? (
        <div className="text-center">
          <button
            onClick={() => setShowEmailRecovery(true)}
            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            <Mail className="h-4 w-4 mr-1 inline" />
            通过邮箱恢复账号
          </button>
          <p className="text-xs text-gray-400 mt-1">
            适用于更换设备或无法使用 Passkey 的情况
          </p>
        </div>
      ) : (
        <form onSubmit={handleEmailRecovery} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              注册时使用的邮箱地址
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={handleInputChange}
                className="input-field pl-10"
                placeholder="请输入邮箱地址"
                required
              />
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => {
                setShowEmailRecovery(false);
                setEmail('');
                setError('');
              }}
              className="btn-secondary flex-1"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                '发送恢复链接'
              )}
            </button>
          </div>
        </form>
      )}

      <div className="mt-8 text-center">
        <p className="text-sm text-gray-600">
          还没有账号？{' '}
          <button
            onClick={onSwitchToRegister}
            className="text-primary-600 hover:text-primary-700 font-medium"
          >
            立即注册
          </button>
        </p>
      </div>
    </div>
  );
} 