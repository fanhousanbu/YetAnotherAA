'use client';

import { useState, useEffect } from 'react';
import { User, Contact, Transfer, WalletInfo } from '@/lib/types';
import { contactStorage, transferStorage, formatCurrency, formatDate } from '@/lib/storage';
import { api, ApiError } from '@/lib/api';
import ContactList from './ContactList';
import AddContactModal from './AddContactModal';
import TransferModal from './TransferModal';
import TransferHistory from './TransferHistory';
import { Users, Plus, LogOut, Wallet, User as UserIcon, RefreshCw } from 'lucide-react';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

type TabType = 'wallet' | 'contacts' | 'transfers';

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('wallet');
  const [showAddContact, setShowAddContact] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadContacts();
    loadTransfers();
    loadWalletInfo();
  }, [user.id]);

  const loadContacts = () => {
    const userContacts = contactStorage.getUserContacts(user.id);
    setContacts(userContacts);
  };

  const loadTransfers = () => {
    const userTransfers = transferStorage.getUserTransfers(user.id);
    setTransfers(userTransfers);
  };

  const loadWalletInfo = async () => {
    setLoading(true);
    setError('');
    
    try {
      const wallet = await api.wallet.getWalletInfo();
      setWalletInfo(wallet);
    } catch (error) {
      console.error('加载钱包信息失败:', error);
      if (error instanceof ApiError) {
        setError(error.message);
      } else {
        setError('加载钱包信息失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = (contact: Contact) => {
    const newContact: Contact = {
      ...contact,
      id: Date.now().toString(),
      userId: user.id,
      createdAt: new Date().toISOString()
    };
    contactStorage.saveContact(newContact);
    loadContacts();
    setShowAddContact(false);
  };

  const handleDeleteContact = (contactId: string) => {
    contactStorage.deleteContact(contactId);
    loadContacts();
  };

  const handleTransfer = (transfer: Transfer) => {
    const newTransfer: Transfer = {
      ...transfer,
      id: Date.now().toString(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    transferStorage.saveTransfer(newTransfer);
    loadTransfers();
    setShowTransfer(false);
    setSelectedContact(null);
  };

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setShowTransfer(true);
  };

  const formatBalance = (balance: string) => {
    const ethBalance = parseFloat(balance) / Math.pow(10, 18);
    return `${ethBalance.toFixed(6)} ETH`;
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">AAStar Demo</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <UserIcon className="h-4 w-4" />
                <span>{user.email}</span>
                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                  Passkey ({user.credentialCount})
                </span>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center space-x-1 text-gray-600 hover:text-gray-900"
              >
                <LogOut className="h-4 w-4" />
                <span>退出</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 用户信息卡片 */}
        <div className="card mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">欢迎回来！</h2>
              <p className="text-gray-600">{user.email}</p>
              <p className="text-sm text-gray-500 mt-1">
                注册时间：{formatDate(user.createdAt)}
              </p>
              <p className="text-sm text-gray-500">
                Passkey 凭证数量：{user.credentialCount}
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary-600">
                {contacts.length}
              </div>
              <div className="text-sm text-gray-500">联系人</div>
            </div>
          </div>
        </div>

        {/* 标签页导航 */}
        <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm mb-6">
          <button
            onClick={() => setActiveTab('wallet')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'wallet'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Wallet className="h-4 w-4" />
            <span>钱包</span>
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'contacts'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>联系人管理</span>
          </button>
          <button
            onClick={() => setActiveTab('transfers')}
            className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'transfers'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Wallet className="h-4 w-4" />
            <span>转账记录</span>
          </button>
        </div>

        {/* 标签页内容 */}
        {activeTab === 'wallet' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">钱包信息</h3>
              <button
                onClick={loadWalletInfo}
                disabled={loading}
                className="btn-secondary flex items-center space-x-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>刷新</span>
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="card">
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="animate-spin h-6 w-6 text-gray-400" />
                  <span className="ml-2 text-gray-600">加载钱包信息中...</span>
                </div>
              </div>
            ) : walletInfo ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">钱包地址</h4>
                  <div className="flex items-center space-x-2">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                      {formatAddress(walletInfo.address)}
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(walletInfo.address)}
                      className="text-primary-600 hover:text-primary-700 text-sm"
                    >
                      复制
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    创建时间：{formatDate(walletInfo.createdAt)}
                  </p>
                </div>

                <div className="card">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">余额</h4>
                  <div className="text-3xl font-bold text-primary-600">
                    {formatBalance(walletInfo.balance)}
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    原始余额：{walletInfo.balance} wei
                  </p>
                </div>
              </div>
            ) : (
              <div className="card">
                <div className="text-center py-8">
                  <p className="text-gray-600">无法加载钱包信息</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">联系人列表</h3>
              <button
                onClick={() => setShowAddContact(true)}
                className="btn-primary flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>添加联系人</span>
              </button>
            </div>

            <ContactList
              contacts={contacts}
              onDelete={handleDeleteContact}
              onTransfer={handleContactSelect}
            />
          </div>
        )}

        {activeTab === 'transfers' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">转账记录</h3>
            <TransferHistory transfers={transfers} user={user} />
          </div>
        )}
      </div>

      {/* 模态框 */}
      {showAddContact && (
        <AddContactModal
          userId={user.id}
          currentUser={user}
          onAdd={handleAddContact}
          onClose={() => setShowAddContact(false)}
        />
      )}

      {showTransfer && selectedContact && (
        <TransferModal
          fromUser={user}
          toContact={selectedContact}
          onTransfer={handleTransfer}
          onClose={() => {
            setShowTransfer(false);
            setSelectedContact(null);
          }}
        />
      )}
    </div>
  );
} 