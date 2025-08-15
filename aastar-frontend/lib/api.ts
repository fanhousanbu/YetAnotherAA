import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/types';

// API 基础配置
const API_BASE = 'http://localhost:3001'; // 指向后端服务器

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

// API 响应类型
export interface User {
  email: string;
  aaAddress: string;
  credentialId: string;
  createdAt: string;
}

export interface RegisterStartResponse {
  options: PublicKeyCredentialCreationOptionsJSON;
}

export interface RegisterCompleteRequest {
  email: string;
  response: RegistrationResponseJSON;
  challenge: string;
}

export interface RegisterCompleteResponse {
  user: User;
}

export interface LoginStartResponse {
  options: PublicKeyCredentialRequestOptionsJSON;
}

export interface LoginCompleteRequest {
  credentialId: string;
  response: AuthenticationResponseJSON;
  challenge: string;
}

export interface LoginCompleteResponse {
  user: User;
}

// 认证相关 API
export const api = {
  auth: {
    // 检查邮箱是否存在
    checkEmailExists: async (email: string) => {
      return apiRequest<{ exists: boolean }>(`/auth/email/check/${encodeURIComponent(email)}`, {
        method: 'GET',
      });
    },

    // 根据邮箱获取用户信息
    getUserByEmail: async (email: string) => {
      return apiRequest<{ user: { email: string; aaAddress: string; createdAt: string } | null }>(`/auth/user/email/${encodeURIComponent(email)}`, {
        method: 'GET',
      });
    },

    // 开始注册流程
    registerStart: async (email: string) => {
      return apiRequest<RegisterStartResponse>('/auth/register/start', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    // 完成注册流程
    registerComplete: async (data: RegisterCompleteRequest) => {
      return apiRequest<RegisterCompleteResponse>('/auth/register/complete', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    // 开始登录流程
    loginStart: async (email: string) => {
      return apiRequest<LoginStartResponse>('/auth/login/start', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },

    // 完成登录流程
    loginComplete: async (data: LoginCompleteRequest) => {
      return apiRequest<LoginCompleteResponse>('/auth/login/complete', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },
  
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

    // 新增：带BLS签名的完整转账接口
    createAndSendSignedTransfer: async (transferData: {
      accountAddress: string;
      to: string;
      value: string;
      data?: string;
      paymasterEnabled?: boolean;
      passkeyVerification: {
        challenge: string;
        response: any;
        credentialPublicKey: string;
        counter: number;
      };
      requiredNodeCount?: number;
    }) => {
      try {
        const response = await fetch(`${API_BASE}/userop/signed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountAddress: transferData.accountAddress,
            txRequest: {
              to: transferData.to,
              value: transferData.value,
              data: transferData.data || '0x',
              operation: 0
            },
            paymasterEnabled: transferData.paymasterEnabled || false,
            passkeyVerification: transferData.passkeyVerification,
            requiredNodeCount: transferData.requiredNodeCount || 3
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Transfer failed');
        }
        
        const result = await response.json();
        console.log('带BLS签名的转账成功:', result);
        return result;
      } catch (error) {
        console.error('带BLS签名的转账失败:', error);
        throw error;
      }
    },

    // 准备签名转账（不发送到链上）
    prepareSignedTransfer: async (transferData: {
      accountAddress: string;
      to: string;
      value: string;
      data?: string;
      paymasterEnabled?: boolean;
      passkeyVerification: {
        challenge: string;
        response: any;
        credentialPublicKey: string;
        counter: number;
      };
      requiredNodeCount?: number;
    }) => {
      try {
        const response = await fetch(`${API_BASE}/userop/prepare`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountAddress: transferData.accountAddress,
            txRequest: {
              to: transferData.to,
              value: transferData.value,
              data: transferData.data || '0x',
              operation: 0
            },
            paymasterEnabled: transferData.paymasterEnabled || false,
            passkeyVerification: transferData.passkeyVerification,
            requiredNodeCount: transferData.requiredNodeCount || 3
          })
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Prepare transfer failed');
        }
        
        const result = await response.json();
        console.log('转账准备完成:', result);
        return result;
      } catch (error) {
        console.error('转账准备失败:', error);
        throw error;
      }
    },
  },
}; 