// 用户类型
export interface User {
  id: string;
  email: string;
  credentialCount: number;
  createdAt: string;
}

// 钱包信息类型
export interface WalletInfo {
  address: string;
  balance: string;
  createdAt: string;
}

// BLS 节点类型
export interface BLSNode {
  nodeId: string;
  endpoint: string;
  status: string;
  lastSeen: string;
  capabilities: string[];
}

// BLS 签名结果类型
export interface BLSSignatureResult {
  aggregatedSignature: string;
  signers: string[];
  publicKeys: string[];
  message: string;
}

// BLS 验证结果类型
export interface BLSVerificationResult {
  valid: boolean;
  verifiedBy: string;
  message: string;
}

// 联系人类型
export interface Contact {
  id: string;
  userId: string;        // 所属用户ID
  walletAddress?: string; // ETH 钱包地址（可选）
  email?: string;        // 邮箱地址（可选）
  name: string;          // 备注名
  createdAt: string;
}

// 转账记录类型
export interface Transfer {
  id: string;
  fromAddress: string;    // 发送方钱包地址
  toAddress: string;      // 接收方钱包地址
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  description?: string;
  createdAt: string;
  txHash?: string;        // 交易哈希
}

// 登录方式
export type LoginMethod = 'email' | 'passkey';

// 注册表单数据
export interface RegisterFormData {
  email: string;
  verificationCode: string;
}

// 登录表单数据
export interface LoginFormData {
  email: string;
}

// 邮箱验证表单数据
export interface EmailVerificationFormData {
  email: string;
  code: string;
}

// 添加联系人表单数据
export interface ContactFormData {
  walletAddress?: string;
  email?: string;
  name: string;
  contactType: 'wallet' | 'email'; // 添加联系人类型
}

// 转账表单数据
export interface TransferFormData {
  toAddress: string;
  amount: number;
  description?: string;
}

// 私钥导出表单数据
export interface ExportPrivateKeyFormData {
  email: string;
  verificationCode: string;
} 