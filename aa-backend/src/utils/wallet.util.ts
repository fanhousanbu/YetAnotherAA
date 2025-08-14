import { Wallet } from 'ethers';
import { CryptoUtil } from './crypto.util';

export class WalletUtil {
  static generateEOAWallet(): { address: string; privateKey: string } {
    const wallet = Wallet.createRandom();
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
    };
  }

  static getWalletFromPrivateKey(privateKey: string): Wallet {
    return new Wallet(privateKey);
  }

  static encryptAndStoreWallet(privateKey: string, userEmail: string): string {
    // Use email as the encryption key for simplicity
    // In production, you might want to use a more secure approach
    return CryptoUtil.encryptPrivateKey(privateKey, userEmail);
  }

  static decryptWallet(encryptedPrivateKey: string, userEmail: string): string {
    return CryptoUtil.decryptPrivateKey(encryptedPrivateKey, userEmail);
  }
}