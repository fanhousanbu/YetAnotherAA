import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

@Injectable()
export class EthereumService {
  private readonly logger = new Logger(EthereumService.name);
  private provider: ethers.JsonRpcProvider;

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('ETH_RPC_URL');
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.logger.log(`连接到以太坊网络: ${rpcUrl}`);
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  async getBalance(address: string): Promise<bigint> {
    return await this.provider.getBalance(address);
  }

  async getCode(address: string): Promise<string> {
    return await this.provider.getCode(address);
  }

  async getFeeData(): Promise<ethers.FeeData> {
    return await this.provider.getFeeData();
  }

  async getNonce(address: string, entryPointAddress: string): Promise<bigint> {
    const entryPointAbi = [
      "function getNonce(address, uint192) view returns (uint256)"
    ];
    
    const entryPoint = new ethers.Contract(
      entryPointAddress,
      entryPointAbi,
      this.provider
    );
    
    return await entryPoint.getNonce(address, 0);
  }

  async getChainId(): Promise<bigint> {
    const network = await this.provider.getNetwork();
    return network.chainId;
  }

  createWallet(privateKey: string): ethers.Wallet {
    return new ethers.Wallet(privateKey, this.provider);
  }

  /**
   * 发送UserOperation到Bundler
   */
  async sendUserOperationToBundler(userOp: any): Promise<string> {
    const bundlerUrl = this.configService.get<string>('BUNDLER_RPC_URL');
    
    try {
      const response = await fetch(bundlerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'eth_sendUserOperation',
          params: [
            userOp,
            this.configService.get<string>('ENTRY_POINT_ADDRESS')
          ],
        }),
      });

      const result = await response.json();
      
      if (result.error) {
        throw new Error(`Bundler错误: ${result.error.message}`);
      }

      return result.result;
    } catch (error) {
      this.logger.error(`发送UserOperation失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 等待UserOperation执行结果
   */
  async waitForUserOperationReceipt(userOpHash: string): Promise<any> {
    const bundlerUrl = this.configService.get<string>('BUNDLER_RPC_URL');
    const maxAttempts = 60; // 最多等待60次，每次2秒
    const delay = 2000;

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(bundlerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'eth_getUserOperationReceipt',
            params: [userOpHash],
          }),
        });

        const result = await response.json();

        if (result.result) {
          return {
            success: result.result.success,
            receipt: result.result.receipt,
            userOpHash: userOpHash,
          };
        }

        // 等待下一次检查
        await new Promise(resolve => setTimeout(resolve, delay));
      } catch (error) {
        this.logger.warn(`检查UserOperation状态失败(第${i + 1}次): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('UserOperation执行超时');
  }
}