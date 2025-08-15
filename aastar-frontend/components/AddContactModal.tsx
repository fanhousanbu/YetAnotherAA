'use client';

import { useState } from 'react';
import { Contact, ContactFormData } from '@/lib/types';
import { contactStorage } from '@/lib/storage';
import { api } from '@/lib/api';
import { User } from '@/lib/types';

interface AddContactModalProps {
  userId: string;
  currentUser: User;
  onAdd: (contact: Contact) => void;
  onClose: () => void;
}

export default function AddContactModal({ userId, currentUser, onAdd, onClose }: AddContactModalProps) {
  const [formData, setFormData] = useState<ContactFormData>({
    walletAddress: '',
    email: '',
    name: '',
    contactType: 'wallet',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generateId = () => {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  };

  const isValidEthereumAddress = (address: string) => {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  };

  const isValidEmailAddress = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const checkEmailExists = async (email: string) => {
    try {
      // 这里可以调用后端 API 检查邮箱是否存在
      // 暂时返回 true 作为示例
      return true;
    } catch (error) {
      console.error('检查邮箱存在性失败:', error);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!formData.name.trim()) {
        setError('请输入联系人姓名');
        return;
      }

      let newContact: Contact;

      if (formData.contactType === 'wallet') {
        // 验证钱包地址格式
        if (!formData.walletAddress || !isValidEthereumAddress(formData.walletAddress)) {
          setError('请输入有效的以太坊钱包地址');
          return;
        }

        // 获取当前用户的钱包地址
        let currentUserWalletAddress = '';
        try {
          const walletInfo = await api.wallet.getAddress();
          currentUserWalletAddress = walletInfo.address;
        } catch (error) {
          console.warn('无法获取当前用户钱包地址:', error);
        }

        // 检查是否添加自己的钱包地址
        if (currentUserWalletAddress && formData.walletAddress.toLowerCase() === currentUserWalletAddress.toLowerCase()) {
          setError('不能添加自己的钱包地址为联系人');
          return;
        }

        // 检查钱包地址是否已存在
        if (contactStorage.isContactExists(userId, formData.walletAddress)) {
          setError('该钱包地址已经在您的联系人列表中');
          return;
        }

        newContact = {
          id: generateId(),
          userId,
          name: formData.name,
          walletAddress: formData.walletAddress,
          createdAt: new Date().toISOString(),
        };
      } else {
        // 验证邮箱地址格式
        if (!formData.email || !isValidEmailAddress(formData.email)) {
          setError('请输入有效的邮箱地址');
          return;
        }

        // 检查是否添加自己的邮箱
        if (formData.email.toLowerCase() === currentUser.email.toLowerCase()) {
          setError('不能添加自己的邮箱地址为联系人');
          return;
        }

        // 检查邮箱是否已在联系人列表中
        if (contactStorage.isContactExists(userId, undefined, formData.email)) {
          setError('该邮箱地址已经在您的联系人列表中');
          return;
        }

        // 检查邮箱是否已注册
        const emailExists = await checkEmailExists(formData.email);
        if (!emailExists) {
          setError('该邮箱地址尚未注册，无法添加为联系人');
          return;
        }

        // 由于后端没有提供 getUserByEmail 接口，暂时创建仅包含邮箱的联系人
        newContact = {
          id: generateId(),
          userId,
          name: formData.name,
          email: formData.email,
          createdAt: new Date().toISOString(),
        };
      }

      onAdd(newContact);
    } catch (error) {
      setError('添加联系人失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">添加联系人</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="关闭"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              联系人类型
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="contactType"
                  value="wallet"
                  checked={formData.contactType === 'wallet'}
                  onChange={(e) => setFormData({ ...formData, contactType: e.target.value as 'wallet' | 'email' })}
                  className="mr-2"
                />
                <span className="text-sm">钱包地址</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="contactType"
                  value="email"
                  checked={formData.contactType === 'email'}
                  onChange={(e) => setFormData({ ...formData, contactType: e.target.value as 'wallet' | 'email' })}
                  className="mr-2"
                />
                <span className="text-sm">邮箱地址</span>
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              联系人姓名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input-field"
              placeholder="请输入联系人姓名"
              required
            />
          </div>

          {formData.contactType === 'wallet' ? (
            <div>
              <label htmlFor="walletAddress" className="block text-sm font-medium text-gray-700 mb-1">
                钱包地址 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="walletAddress"
                value={formData.walletAddress}
                onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                className="input-field"
                placeholder="0x..."
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                请输入有效的以太坊钱包地址
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                邮箱地址 <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input-field"
                placeholder="user@example.com"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                请输入已注册用户的邮箱地址
              </p>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={loading}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={loading}
            >
              {loading ? '添加中...' : '添加联系人'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 