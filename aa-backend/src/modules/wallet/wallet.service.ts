import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonRpcProvider } from 'ethers';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../auth/email.service';
import { WalletUtil } from '../../utils/wallet.util';
import { WalletInfoDto } from './dto/wallet.dto';

@Injectable()
export class WalletService {
  private provider: JsonRpcProvider;

  constructor(
    private configService: ConfigService,
    private storageService: StorageService,
    private emailService: EmailService,
  ) {
    const rpcUrl = this.configService.get('blockchain.rpcUrl');
    this.provider = new JsonRpcProvider(rpcUrl);
  }

  async getWalletInfo(userId: string): Promise<WalletInfoDto> {
    const wallet = await this.storageService.getWalletByUserId(userId);
    
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Get balance from blockchain
    const balance = await this.provider.getBalance(wallet.address);

    return {
      address: wallet.address,
      balance: balance.toString(),
      createdAt: wallet.createdAt,
    };
  }

  async getWalletBalance(userId: string): Promise<{ balance: string }> {
    const wallet = await this.storageService.getWalletByUserId(userId);
    
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    const balance = await this.provider.getBalance(wallet.address);
    
    return {
      balance: balance.toString(),
    };
  }

  async exportPrivateKey(userId: string, email: string, verificationCode: string): Promise<{ privateKey: string }> {
    // Verify email code first
    const emailVerification = await this.emailService.verifyCode(email, verificationCode);
    if (!emailVerification.success) {
      throw new BadRequestException('Invalid verification code');
    }

    // Get user to verify email matches
    const user = await this.storageService.getUserById(userId);
    if (!user || user.email !== email) {
      throw new BadRequestException('Email mismatch');
    }

    // Get wallet
    const wallet = await this.storageService.getWalletByUserId(userId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Decrypt private key
    const privateKey = WalletUtil.decryptWallet(wallet.encryptedPrivateKey, email);
    
    return {
      privateKey,
    };
  }

  async getWalletAddress(userId: string): Promise<{ address: string }> {
    const wallet = await this.storageService.getWalletByUserId(userId);
    
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    return {
      address: wallet.address,
    };
  }

  async signMessage(userId: string, message: string): Promise<{ signature: string }> {
    const user = await this.storageService.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const wallet = await this.storageService.getWalletByUserId(userId);
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }

    // Decrypt private key
    const privateKey = WalletUtil.decryptWallet(wallet.encryptedPrivateKey, user.email);
    
    // Create wallet instance and sign
    const walletInstance = WalletUtil.getWalletFromPrivateKey(privateKey);
    const signature = await walletInstance.signMessage(message);
    
    return {
      signature,
    };
  }
}