'use client';

import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';
import { User } from '@/lib/types';
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
  const [step, setStep] = useState<'email' | 'passkey'>('email');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    setError('');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('请输入邮箱地址');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 开始 Passkey 登录流程
      await api.auth.loginBegin(email);
      setStep('passkey');
    } catch (error) {
      console.error('开始登录失败:', error);
      if (error instanceof ApiError) {
        if (error.status === 404) {
          setError('该邮箱未注册，请先注册账户');
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

  const handlePasskeyLogin = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. 获取登录选项
      const options = await api.auth.loginBegin(email);

      // 2. 验证 passkey
      const credential = await startAuthentication({
        optionsJSON: options
      });

      // 3. 完成登录
      const result = await api.auth.loginComplete(options.challenge, credential);

      if (result.success) {
        // 保存访问令牌
        localStorage.setItem('accessToken', result.accessToken);
        
        // 获取用户信息
        const user = await api.user.getCurrentUser();
        onLogin(user);
      } else {
        throw new Error(result.message || '登录失败');
      }
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
      } else if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          setError('用户取消了 Passkey 验证或操作超时');
        } else if (error.name === 'InvalidStateError') {
          setError('Passkey 状态无效，请重试');
        } else if (error.name === 'NotSupportedError') {
          setError('您的设备或浏览器不支持 Passkey 功能');
        } else if (error.name === 'SecurityError') {
          setError('安全错误：请确保在安全的 HTTPS 环境下使用');
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

      {/* 步骤指示器 */}
      <div className="flex items-center justify-center space-x-4 mb-6">
        <div className={`flex items-center ${step === 'email' ? 'text-blue-600' : 'text-green-600'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'email' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'
          }`}>
            1
          </div>
          <span className="ml-2 text-sm">邮箱</span>
        </div>
        <div className={`w-8 h-0.5 ${step === 'passkey' ? 'bg-green-600' : 'bg-gray-300'}`}></div>
        <div className={`flex items-center ${step === 'passkey' ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'passkey' ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-500'
          }`}>
            2
          </div>
          <span className="ml-2 text-sm">Passkey</span>
        </div>
      </div>

      {/* 步骤 1: 邮箱输入 */}
      {step === 'email' && (
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              邮箱地址
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

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full flex items-center justify-center py-3 text-lg"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
            ) : (
              <>
                <Mail className="h-6 w-6 mr-3" />
                下一步
              </>
            )}
          </button>
        </form>
      )}

      {/* 步骤 2: Passkey 验证 */}
      {step === 'passkey' && (
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              正在为 {email} 准备 Passkey 验证
            </p>
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={() => setStep('email')}
              className="btn-secondary flex-1"
            >
              返回
            </button>
            <button
              onClick={handlePasskeyLogin}
              disabled={loading}
              className="btn-primary flex-1 flex items-center justify-center"
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
          </div>
        </div>
      )}

      {/* 分隔线 */}
      <div className="relative mb-6 mt-8">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-white text-gray-500">遇到问题？</span>
        </div>
      </div>

      {/* 邮箱恢复选项 */}
      <div className="text-center">
        <button
          onClick={handleEmailRecovery}
          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
        >
          <Mail className="h-4 w-4 mr-1 inline" />
          通过邮箱恢复账号
        </button>
        <p className="text-xs text-gray-400 mt-1">
          适用于更换设备或无法使用 Passkey 的情况
        </p>
      </div>

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