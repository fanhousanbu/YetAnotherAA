import { User, Contact, Transfer } from './types';

// 本地存储键名
const STORAGE_KEYS = {
  USERS: 'frontdoor_users',
  CONTACTS: 'frontdoor_contacts',
  TRANSFERS: 'frontdoor_transfers',
  CURRENT_USER: 'frontdoor_current_user',
  PASSKEY_CREDENTIALS: 'frontdoor_passkey_credentials',
} as const;

// 生成唯一ID
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 格式化日期
export function formatDate(date: string): string {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 格式化钱包地址
export function formatAddress(address: string): string {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// 用户存储
export const userStorage = {
  // 保存用户
  saveUser(user: User): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
  },

  // 获取当前用户
  getCurrentUser(): User | null {
    const user = localStorage.getItem('currentUser');
    return user ? JSON.parse(user) : null;
  },

  // 通过邮箱获取用户
  getUserByEmail(email: string): User | null {
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.email === email) {
      return currentUser;
    }
    return null;
  },

  // 通过钱包地址获取用户
  getUserByAddress(address: string): User | null {
    const currentUser = this.getCurrentUser();
    if (currentUser && currentUser.walletAddress.toLowerCase() === address.toLowerCase()) {
      return currentUser;
    }
    return null;
  },

  // 清除当前用户
  clearCurrentUser(): void {
    localStorage.removeItem('currentUser');
  }
};

// Passkey 存储
export const passkeyStorage = {
  // 保存 Passkey 凭证
  saveCredential(email: string, credential: PublicKeyCredential): void {
    const credentials = this.getCredentials();
    credentials[email] = credential;
    localStorage.setItem('passkeys', JSON.stringify(credentials));
  },

  // 获取所有 Passkey 凭证
  getCredentials(): Record<string, PublicKeyCredential> {
    const credentials = localStorage.getItem('passkeys');
    return credentials ? JSON.parse(credentials) : {};
  },

  // 获取指定邮箱的 Passkey 凭证
  getCredentialByEmail(email: string): PublicKeyCredential | null {
    const credentials = this.getCredentials();
    return credentials[email] || null;
  }
};

// 联系人存储
export const contactStorage = {
  // 保存联系人
  saveContact(contact: Contact): void {
    const contacts = this.getContacts();
    contacts.push(contact);
    localStorage.setItem('contacts', JSON.stringify(contacts));
  },

  // 获取所有联系人
  getContacts(): Contact[] {
    const contacts = localStorage.getItem('contacts');
    return contacts ? JSON.parse(contacts) : [];
  },

  // 获取用户的联系人
  getUserContacts(userId: string): Contact[] {
    const contacts = this.getContacts();
    return contacts.filter(contact => contact.userId === userId);
  },

  // 通过钱包地址获取联系人
  getContactByAddress(address: string): Contact | null {
    const contacts = this.getContacts();
    return contacts.find(c => c.walletAddress && c.walletAddress.toLowerCase() === address.toLowerCase()) || null;
  },

  // 通过邮箱获取联系人
  getContactByEmail(email: string): Contact | null {
    const contacts = this.getContacts();
    return contacts.find(c => c.email && c.email.toLowerCase() === email.toLowerCase()) || null;
  },

  // 检查联系人是否已存在（通过钱包地址或邮箱）
  isContactExists(userId: string, walletAddress?: string, email?: string): boolean {
    const contacts = this.getUserContacts(userId);
    
    if (walletAddress) {
      return contacts.some(c => c.walletAddress && c.walletAddress.toLowerCase() === walletAddress.toLowerCase());
    }
    
    if (email) {
      return contacts.some(c => c.email && c.email.toLowerCase() === email.toLowerCase());
    }
    
    return false;
  },

  // 更新联系人
  updateContact(contact: Contact): void {
    const contacts = this.getContacts();
    const index = contacts.findIndex(c => c.id === contact.id);
    if (index !== -1) {
      contacts[index] = contact;
      localStorage.setItem('contacts', JSON.stringify(contacts));
    }
  },

  // 删除联系人
  deleteContact(id: string): void {
    const contacts = this.getContacts();
    const filteredContacts = contacts.filter(c => c.id !== id);
    localStorage.setItem('contacts', JSON.stringify(filteredContacts));
  }
};

// 转账记录存储
export const transferStorage = {
  // 保存转账记录
  saveTransfer(transfer: Transfer): void {
    const transfers = this.getTransfers();
    transfers.push(transfer);
    localStorage.setItem('transfers', JSON.stringify(transfers));
  },

  // 获取所有转账记录
  getTransfers(): Transfer[] {
    const transfers = localStorage.getItem('transfers');
    return transfers ? JSON.parse(transfers) : [];
  },

  // 获取用户相关的转账记录
  getUserTransfers(address: string): Transfer[] {
    const transfers = this.getTransfers();
    return transfers.filter(t => 
      t.fromAddress.toLowerCase() === address.toLowerCase() || 
      t.toAddress.toLowerCase() === address.toLowerCase()
    );
  },

  // 更新转账记录
  updateTransfer(transfer: Transfer): void {
    const transfers = this.getTransfers();
    const index = transfers.findIndex(t => t.id === transfer.id);
    if (index !== -1) {
      transfers[index] = transfer;
      localStorage.setItem('transfers', JSON.stringify(transfers));
    }
  }
};

// 工具函数
export const formatCurrency = (amount: number, currency: string = 'CNY'): string => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
  }).format(amount);
}; 