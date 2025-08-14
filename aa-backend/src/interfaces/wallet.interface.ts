export interface UserWallet {
  id: string;
  userId: string;
  email: string;
  address: string;
  encryptedPrivateKey: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletInfo {
  address: string;
  balance: string;
  createdAt: Date;
}