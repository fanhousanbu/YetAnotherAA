import { User, Contact, Transfer } from './types';
import { userStorage, contactStorage, transferStorage, generateId } from './storage';
import { api } from './api';

// 初始化演示账号
export function initializeDemoData(): void {
  const demoUser: User = {
    id: 'demo1',
    email: 'demo@example.com',
    credentialCount: 1,
    createdAt: new Date().toISOString()
  };

  // 保存演示用户
  if (!userStorage.getCurrentUser()) {
    userStorage.saveUser(demoUser);
  }

  // 创建演示联系人
  const contact1: Contact = {
    id: generateId(),
    userId: demoUser.id,
    name: 'Alice',
    walletAddress: '0x1234567890123456789012345678901234567890',
    createdAt: new Date().toISOString()
  };

  const contact2: Contact = {
    id: generateId(),
    userId: demoUser.id,
    name: 'Bob',
    walletAddress: '0x2345678901234567890123456789012345678901',
    createdAt: new Date().toISOString()
  };

  const contact3: Contact = {
    id: generateId(),
    userId: demoUser.id,
    name: 'Charlie',
    walletAddress: '0x3456789012345678901234567890123456789012',
    createdAt: new Date().toISOString()
  };

  // 添加邮箱联系人
  const contact4: Contact = {
    id: generateId(),
    userId: demoUser.id,
    name: 'Alice (邮箱)',
    email: 'alice@example.com',
    createdAt: new Date().toISOString()
  };

  const contact5: Contact = {
    id: generateId(),
    userId: demoUser.id,
    name: 'Test User',
    email: 'test@example.com',
    createdAt: new Date().toISOString()
  };

  // 保存联系人
  contactStorage.saveContact(contact1);
  contactStorage.saveContact(contact2);
  contactStorage.saveContact(contact3);
  contactStorage.saveContact(contact4);
  contactStorage.saveContact(contact5);

  // 创建演示转账记录
  const transfer1: Transfer = {
    id: generateId(),
    fromAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    toAddress: contact1.walletAddress!,
    amount: 1.5,
    status: 'completed',
    description: '转账给 Alice',
    createdAt: new Date().toISOString(),
    txHash: '0x123...abc'
  };

  const transfer2: Transfer = {
    id: generateId(),
    fromAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    toAddress: contact2.walletAddress!,
    amount: 0.5,
    status: 'completed',
    description: '转账给 Bob',
    createdAt: new Date().toISOString(),
    txHash: '0x456...def'
  };

  const transfer3: Transfer = {
    id: generateId(),
    fromAddress: contact3.walletAddress!,
    toAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
    amount: 0.8,
    status: 'completed',
    description: '收到来自 Charlie 的转账',
    createdAt: new Date().toISOString(),
    txHash: '0x789...ghi'
  };

  // 保存转账记录
  transferStorage.saveTransfer(transfer1);
  transferStorage.saveTransfer(transfer2);
  transferStorage.saveTransfer(transfer3);
}

// 获取演示账号列表
export function getDemoUsers(): User[] {
  return [{
    id: 'demo1',
    email: 'demo@example.com',
    credentialCount: 1,
    createdAt: new Date().toISOString()
  }];
}

// 检查是否是有效的以太坊地址
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// 检查是否是有效的邮箱地址
export function isValidEmailAddress(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 检查邮箱是否已注册
export async function checkEmailExists(email: string): Promise<boolean> {
  try {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 模拟一些已注册的邮箱
    const registeredEmails = [
      'demo@example.com',
      'alice@example.com',
      'bob@example.com',
      'charlie@example.com',
      'test@example.com'
    ];
    
    return registeredEmails.includes(email.toLowerCase());
  } catch (error) {
    console.warn('Failed to check email:', error);
    return false;
  }
}

// 清除所有演示数据
export function clearDemoData() {
  localStorage.clear();
  console.log('演示数据已清除');
}

console.log('演示数据初始化完成'); 