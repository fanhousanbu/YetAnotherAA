import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/types';

// API 基础配置
const API_BASE = 'http://localhost:3000'; // 指向后端服务器

// API 错误类型
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// API 请求封装
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data.message || `API request failed: ${response.status} ${response.statusText}`);
  }

  return data;
}

// 带认证的 API 请求
async function authenticatedRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    throw new ApiError(401, '未登录，请先登录');
  }

  return apiRequest<T>(endpoint, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

// API 响应类型
export interface User {
  id: string;
  email: string;
  credentialCount: number;
  createdAt: string;
}

export interface WalletInfo {
  address: string;
  balance: string;
  createdAt: string;
}

export interface BLSNode {
  nodeId: string;
  endpoint: string;
  status: string;
  lastSeen: string;
  capabilities: string[];
}

export interface BLSSignatureResult {
  aggregatedSignature: string;
  signers: string[];
  publicKeys: string[];
  message: string;
}

export interface BLSVerificationResult {
  valid: boolean;
  verifiedBy: string;
  message: string;
}

// 认证相关 API
export const api = {
  auth: {
    // 发送邮箱验证码
    sendVerificationCode: async (email: string) => {
      return apiRequest<{ message: string }>('/auth/email/send-code', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    // 验证邮箱验证码
    verifyEmail: async (email: string, code: string) => {
      return apiRequest<{ message: string }>('/auth/email/verify-code', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
    },

    // 开始 Passkey 注册
    registerBegin: async (email: string, verificationCode: string) => {
      return apiRequest<PublicKeyCredentialCreationOptionsJSON>('/auth/passkey/register/begin', {
        method: 'POST',
        body: JSON.stringify({ email, verificationCode }),
      });
    },

    // 完成 Passkey 注册
    registerComplete: async (challenge: string, credential: any) => {
      return apiRequest<{
        success: boolean;
        userId: string;
        accessToken: string;
        walletAddress: string;
        message: string;
      }>('/auth/passkey/register/complete', {
        method: 'POST',
        body: JSON.stringify({ challenge, credential }),
      });
    },

    // 开始 Passkey 登录
    loginBegin: async (email: string) => {
      return apiRequest<PublicKeyCredentialRequestOptionsJSON>('/auth/passkey/login/begin', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    // 完成 Passkey 登录
    loginComplete: async (challenge: string, credential: any) => {
      return apiRequest<{
        success: boolean;
        userId: string;
        accessToken: string;
        message: string;
      }>('/auth/passkey/login/complete', {
        method: 'POST',
        body: JSON.stringify({ challenge, credential }),
      });
    },
  },

  user: {
    // 获取当前用户信息
    getCurrentUser: async () => {
      return authenticatedRequest<User>('/user/me');
    },
  },

  wallet: {
    // 获取钱包信息
    getWalletInfo: async () => {
      return authenticatedRequest<WalletInfo>('/wallet/info');
    },

    // 获取钱包余额
    getBalance: async () => {
      return authenticatedRequest<{ balance: string }>('/wallet/balance');
    },

    // 获取钱包地址
    getAddress: async () => {
      return authenticatedRequest<{ address: string }>('/wallet/address');
    },

    // 导出私钥（需要邮箱验证）
    exportPrivateKey: async (email: string, verificationCode: string) => {
      return authenticatedRequest<{ privateKey: string }>('/wallet/export-private-key', {
        method: 'POST',
        body: JSON.stringify({ email, verificationCode }),
      });
    },

    // 获取可用的 BLS 签名节点
    getAvailableSigners: async () => {
      return authenticatedRequest<{
        signers: BLSNode[];
        count: number;
      }>('/wallet/bls/signers');
    },

    // 使用 BLS 签名消息
    signWithBLS: async (message: string, signerCount?: number) => {
      return authenticatedRequest<BLSSignatureResult>('/wallet/bls/sign', {
        method: 'POST',
        body: JSON.stringify({ message, signerCount: signerCount || 3 }),
      });
    },

    // 验证 BLS 签名
    verifyBLS: async (message: string, aggregatedSignature: string, publicKeys: string[]) => {
      return authenticatedRequest<BLSVerificationResult>('/wallet/bls/verify', {
        method: 'POST',
        body: JSON.stringify({ message, aggregatedSignature, publicKeys }),
      });
    },
  },
  
  // 保留原有的转账相关 API（如果需要的话）
  transfer: {
    // 创建并发送转账用户操作（组合接口）
    createTransfer: async (data: {
      accountAddress: string;
      toAddress: string;
      amount: string; // ETH amount in string
    }) => {
      const txRequest = {
        to: data.toAddress,
        value: data.amount,
        data: '0x', // 简单转账不需要额外数据
        operation: 0 // CALL 操作
      };

      return apiRequest<{ userOperation: any; userOpHash: string }>('/api/userop', {
        method: 'POST',
        body: JSON.stringify({
          accountAddress: data.accountAddress,
          txRequest,
          paymasterEnabled: false
        }),
      });
    },

    // 发送已签名的转账用户操作
    sendTransfer: async (userOp: any) => {
      return apiRequest<{ userOpHash: string }>('/api/userop/send', {
        method: 'POST',
        body: JSON.stringify(userOp),
      });
    },

    // 估算转账费用
    estimateTransferGas: async (data: {
      accountAddress: string;
      toAddress: string;
      amount: string;
    }) => {
      const txRequest = {
        to: data.toAddress,
        value: data.amount,
        data: '0x',
        operation: 0
      };

      return apiRequest<{ gasEstimation: any }>('/api/userop/estimate', {
        method: 'POST',
        body: JSON.stringify({
          accountAddress: data.accountAddress,
          txRequest,
          paymasterEnabled: false
        }),
      });
    },
  },
}; 