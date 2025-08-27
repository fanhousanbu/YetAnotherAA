import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { UserOperation } from '../common/interfaces/erc4337.interface';

@Injectable()
export class EthereumService {
  private provider: ethers.JsonRpcProvider;
  private bundlerProvider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;

  // Contract ABIs
  private readonly FACTORY_ABI = [
    'function getAddress(address owner, address validator, bool useAAStarValidator, uint256 salt) view returns (address)',
    'function createAccountWithAAStarValidator(address owner, address aaStarValidator, bool useAAStarValidator, uint256 salt) returns (address)',
  ];

  private readonly ACCOUNT_ABI = [
    'function execute(address dest, uint256 value, bytes calldata func) external',
  ];

  private readonly ENTRY_POINT_ABI = [
    'function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external',
    'function getNonce(address sender, uint192 key) external view returns (uint256 nonce)',
    'function getUserOpHash((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external view returns (bytes32)',
    'function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address payable beneficiary) external',
  ];

  private readonly VALIDATOR_ABI = [
    'function getGasEstimate(uint256 nodeCount) external pure returns (uint256 gasEstimate)',
  ];

  constructor(private configService: ConfigService) {
    const rpcUrl = this.configService.get<string>('ETH_RPC_URL');
    const bundlerRpcUrl = this.configService.get<string>('BUNDLER_RPC_URL');
    const privateKey = this.configService.get<string>('ETH_PRIVATE_KEY');

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.bundlerProvider = new ethers.JsonRpcProvider(bundlerRpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getBundlerProvider(): ethers.JsonRpcProvider {
    return this.bundlerProvider;
  }

  getWallet(): ethers.Wallet {
    return this.wallet;
  }

  getFactoryContract(): ethers.Contract {
    const address = this.configService.get<string>('AASTAR_ACCOUNT_FACTORY_ADDRESS');
    return new ethers.Contract(address, this.FACTORY_ABI, this.wallet);
  }

  getEntryPointContract(): ethers.Contract {
    const address = this.configService.get<string>('ENTRY_POINT_ADDRESS');
    return new ethers.Contract(address, this.ENTRY_POINT_ABI, this.wallet);
  }

  getValidatorContract(): ethers.Contract {
    const address = this.configService.get<string>('VALIDATOR_CONTRACT_ADDRESS');
    return new ethers.Contract(address, this.VALIDATOR_ABI, this.provider);
  }

  getAccountContract(address: string): ethers.Contract {
    return new ethers.Contract(address, this.ACCOUNT_ABI, this.provider);
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  async getNonce(accountAddress: string, key: number = 0): Promise<bigint> {
    const entryPoint = this.getEntryPointContract();
    return await entryPoint.getNonce(accountAddress, key);
  }

  async getUserOpHash(userOp: UserOperation): Promise<string> {
    const entryPoint = this.getEntryPointContract();
    const userOpArray = [
      userOp.sender,
      userOp.nonce,
      userOp.initCode,
      userOp.callData,
      userOp.callGasLimit,
      userOp.verificationGasLimit,
      userOp.preVerificationGas,
      userOp.maxFeePerGas,
      userOp.maxPriorityFeePerGas,
      userOp.paymasterAndData,
      userOp.signature,
    ];
    return await entryPoint.getUserOpHash(userOpArray);
  }

  async estimateUserOperationGas(userOp: any): Promise<any> {
    try {
      return await this.bundlerProvider.send('eth_estimateUserOperationGas', [
        userOp,
        this.configService.get('ENTRY_POINT_ADDRESS'),
      ]);
    } catch (error) {
      // Return default values if estimation fails
      return {
        callGasLimit: '0x249f0', // 150000
        verificationGasLimit: '0xf4240', // 1000000
        preVerificationGas: '0x11170', // 70000
      };
    }
  }

  async sendUserOperation(userOp: any): Promise<string> {
    return await this.bundlerProvider.send('eth_sendUserOperation', [
      userOp,
      this.configService.get('ENTRY_POINT_ADDRESS'),
    ]);
  }

  async getUserOperationReceipt(userOpHash: string): Promise<any> {
    return await this.bundlerProvider.send('eth_getUserOperationReceipt', [userOpHash]);
  }

  async waitForUserOp(userOpHash: string, maxAttempts: number = 60): Promise<string> {
    const pollInterval = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const receipt = await this.getUserOperationReceipt(userOpHash);
        if (receipt && (receipt.transactionHash || receipt.receipt?.transactionHash)) {
          return receipt.transactionHash || receipt.receipt?.transactionHash;
        }
      } catch (error) {
        // Continue polling
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`UserOp timeout: ${userOpHash}`);
  }
}