import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonRpcProvider } from 'ethers';
import { StorageService } from '../storage/storage.service';
import { EmailService } from '../auth/email.service';
import { BlsNodeDiscoveryService } from '../blockchain/gossip-discovery.service';
import { WalletUtil } from '../../utils/wallet.util';
import { WalletInfoDto } from './dto/wallet.dto';

@Injectable()
export class WalletService {
  private provider: JsonRpcProvider;

  constructor(
    private configService: ConfigService,
    private storageService: StorageService,
    private emailService: EmailService,
    private discoveryService: BlsNodeDiscoveryService,
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

  /**
   * 获取可用的BLS签名节点
   */
  async getAvailableSigners(): Promise<any[]> {
    try {
      const blsNodes = await this.discoveryService.getAvailableNodes();
      return blsNodes.map(node => ({
        nodeId: node.nodeId,
        endpoint: node.apiEndpoint,
        status: node.status,
        lastSeen: node.lastSeen,
        capabilities: node.capabilities,
      }));
    } catch (error) {
      console.error('Failed to get available signers:', error);
      return [];
    }
  }

  /**
   * 使用BLS聚合签名签署消息
   */
  async signMessageWithBLS(userId: string, message: string, signerCount: number = 3): Promise<{
    aggregatedSignature: string;
    signers: string[];
    publicKeys: string[];
  }> {
    try {
      // 选择BLS签名节点
      const selectedSigners = await this.discoveryService.selectSigners(signerCount);
      
      if (selectedSigners.length < signerCount) {
        throw new BadRequestException(`Insufficient BLS signers: need ${signerCount}, available ${selectedSigners.length}`);
      }

      // 准备签名请求
      const signatureRequests = selectedSigners.map(async (signer) => {
        try {
          const response = await fetch(`${signer.apiEndpoint}/signature/sign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message }),
          });

          if (!response.ok) {
            throw new Error(`Signer ${signer.nodeId} failed: ${response.statusText}`);
          }

          const result = await response.json();
          return {
            nodeId: signer.nodeId,
            signature: result.signature,
            publicKey: result.publicKey,
          };
        } catch (error) {
          console.error(`Failed to get signature from ${signer.nodeId}:`, error);
          throw error;
        }
      });

      // 等待所有签名完成
      const signatures = await Promise.all(signatureRequests);

      // 聚合签名 (这里需要调用第一个节点的聚合API)
      const aggregationResponse = await fetch(`${selectedSigners[0].apiEndpoint}/signature/aggregate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatures: signatures.map(s => s.signature),
          publicKeys: signatures.map(s => s.publicKey),
          message,
        }),
      });

      if (!aggregationResponse.ok) {
        throw new Error(`Aggregation failed: ${aggregationResponse.statusText}`);
      }

      const aggregationResult = await aggregationResponse.json();

      return {
        aggregatedSignature: aggregationResult.aggregatedSignature,
        signers: signatures.map(s => s.nodeId),
        publicKeys: signatures.map(s => s.publicKey),
      };

    } catch (error) {
      console.error('BLS signature aggregation failed:', error);
      throw new BadRequestException(`BLS signature failed: ${error.message}`);
    }
  }

  /**
   * 验证BLS聚合签名
   */
  async verifyBLSSignature(
    message: string, 
    aggregatedSignature: string, 
    publicKeys: string[]
  ): Promise<{ valid: boolean; verifiedBy?: string }> {
    try {
      // 使用第一个可用的BLS节点进行验证
      const availableNodes = await this.discoveryService.getAvailableNodes();
      
      if (availableNodes.length === 0) {
        throw new BadRequestException('No BLS verification nodes available');
      }

      const verificationResponse = await fetch(`${availableNodes[0].apiEndpoint}/signature/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          aggregatedSignature,
          publicKeys,
        }),
      });

      if (!verificationResponse.ok) {
        throw new Error(`Verification failed: ${verificationResponse.statusText}`);
      }

      const result = await verificationResponse.json();
      
      return {
        valid: result.valid,
        verifiedBy: availableNodes[0].nodeId,
      };

    } catch (error) {
      console.error('BLS signature verification failed:', error);
      throw new BadRequestException(`BLS verification failed: ${error.message}`);
    }
  }
}