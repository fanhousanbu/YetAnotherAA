'use client';

import { useState } from 'react';
import { Contact, User } from '@/lib/types';
import { generateId, contactStorage } from '@/lib/storage';
import { isValidEthereumAddress, isValidEmailAddress, checkEmailExists } from '@/lib/demo-data';
import { api } from '@/lib/api';
import { User as LucideUser, X, Mail, Wallet } from 'lucide-react';

interface AddContactModalProps {
  userId: string;
  currentUser: User;
  onAdd: (contact: Contact) => void;
  onClose: () => void;
}

export default function AddContactModal({ userId, currentUser, onAdd, onClose }: AddContactModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    walletAddress: '',
    email: '',
    contactType: 'wallet' as 'wallet' | 'email',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleContactTypeChange = (type: 'wallet' | 'email') => {
    setFormData(prev => ({ 
      ...prev, 
      contactType: type,
      walletAddress: '',
      email: ''
    }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let newContact: Contact;

      if (formData.contactType === 'wallet') {
        // 验证钱包地址格式
        if (!isValidEthereumAddress(formData.walletAddress)) {
          setError('请输入有效的以太坊钱包地址');
          return;
        }

        // 检查是否添加自己的钱包地址
        if (formData.walletAddress.toLowerCase() === currentUser.walletAddress.toLowerCase()) {
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
        if (!isValidEmailAddress(formData.email)) {
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

        // 获取邮箱对应的用户信息（包括钱包地址）
        try {
          const { user: emailUser } = await api.auth.getUserByEmail(formData.email);
          if (!emailUser) {
            setError('无法获取该邮箱对应的用户信息');
            return;
          }

          newContact = {
            id: generateId(),
            userId,
            name: formData.name,
            email: formData.email,
            walletAddress: emailUser.aaAddress, // 同时存储钱包地址
            createdAt: new Date().toISOString(),
          };
        } catch (error) {
          console.warn('Failed to get user by email via API, creating email-only contact:', error);
          // 如果API调用失败，仍然创建仅包含邮箱的联系人
          newContact = {
            id: generateId(),
            userId,
            name: formData.name,
            email: formData.email,
            createdAt: new Date().toISOString(),
          };
        }
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
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* 联系人类型选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              添加方式 <span className="text-red-500">*</span>
            </label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => handleContactTypeChange('wallet')}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg border transition-colors ${
                  formData.contactType === 'wallet'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Wallet className="h-5 w-5" />
                <span>钱包地址</span>
              </button>
              <button
                type="button"
                onClick={() => handleContactTypeChange('email')}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg border transition-colors ${
                  formData.contactType === 'email'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Mail className="h-5 w-5" />
                <span>邮箱地址</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formData.contactType === 'wallet' 
                ? '通过钱包地址直接添加联系人' 
                : '通过邮箱地址添加已注册用户为联系人'
              }
            </p>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              备注名 <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <LucideUser className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="input-field pl-10"
                placeholder="请输入联系人备注名"
                required
              />
            </div>
          </div>

          {formData.contactType === 'wallet' ? (
            <div>
              <label htmlFor="walletAddress" className="block text-sm font-medium text-gray-700 mb-1">
                钱包地址 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Wallet className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="text"
                  id="walletAddress"
                  name="walletAddress"
                  value={formData.walletAddress}
                  onChange={handleInputChange}
                  className="input-field pl-10 font-mono"
                  placeholder="0x..."
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                请输入有效的以太坊钱包地址（以 0x 开头的 42 位十六进制字符）
              </p>
            </div>
          ) : (
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                邮箱地址 <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="input-field pl-10"
                  placeholder="example@email.com"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                请输入已注册用户的邮箱地址，系统将验证该邮箱是否存在
              </p>
            </div>
          )}

          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto"></div>
              ) : (
                '添加联系人'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 