'use client';

import { useState, useEffect } from 'react';
import { User, Contact, Transfer } from '@/lib/types';
import { contactStorage, transferStorage, formatCurrency, formatDate } from '@/lib/storage';
import ContactList from './ContactList';
import AddContactModal from './AddContactModal';
import TransferModal from './TransferModal';
import TransferHistory from './TransferHistory';
import { Users, Plus, LogOut, Wallet, User as UserIcon } from 'lucide-react';

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

type TabType = 'contacts' | 'transfers';

export default function Dashboard({ user, onLogout }: DashboardProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>('contacts');
  const [showAddContact, setShowAddContact] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  useEffect(() => {
    loadContacts();
    loadTransfers();
  }, [user.id]);

  const loadContacts = () => {
    const userContacts = contactStorage.getUserContacts(user.id);
    setContacts(userContacts);
  };

  const loadTransfers = () => {
    const userTransfers = transferStorage.getUserTransfers(user.id);
    setTransfers(userTransfers);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">FrontDoor Demo</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <UserIcon className="h-4 w-4" />
                <span>{user.name}</span>
                {user.hasPasskey && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                    Passkey
                  </span>
                )}
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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">欢迎回来，{user.name}！</h2>
              <p className="text-gray-600">{user.email}</p>
              <p className="text-sm text-gray-500 mt-1">
                注册时间：{formatDate(user.createdAt)}
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