import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.Provider;
  private wallet: ethers.Wallet;

  constructor() {
    this.initializeProvider();
  }

  private initializeProvider(): void {
    const rpcUrl = process.env.ETH_RPC_URL || 'https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20';
    const privateKey = process.env.ETH_PRIVATE_KEY;

    if (!privateKey) {
      this.logger.warn('ETH_PRIVATE_KEY not set, blockchain operations will be disabled');
      return;
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.logger.log(`Blockchain service initialized with wallet: ${this.wallet.address}`);
  }

  async registerNodeOnChain(
    contractAddress: string,
    nodeId: string,
    publicKey: string
  ): Promise<string> {
    if (!this.wallet) {
      throw new Error('Blockchain not configured. Set ETH_PRIVATE_KEY environment variable.');
    }

    const abi = [
      "function registerPublicKey(bytes32 nodeId, bytes calldata publicKey) external",
      "function isRegistered(bytes32 nodeId) external view returns (bool)"
    ];

    const contract = new ethers.Contract(contractAddress, abi, this.wallet);

    try {
      // Check if already registered
      const isAlreadyRegistered = await contract.isRegistered(nodeId);
      if (isAlreadyRegistered) {
        this.logger.warn(`Node ${nodeId} is already registered on-chain`);
        return 'already_registered';
      }

      this.logger.log(`Registering node ${nodeId} on contract ${contractAddress}`);
      
      // Call registerPublicKey function
      const tx = await contract.registerPublicKey(nodeId, publicKey);
      this.logger.log(`Transaction submitted: ${tx.hash}`);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      this.logger.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
      
      return tx.hash;
    } catch (error: any) {
      this.logger.error(`Failed to register node on-chain: ${error.message}`);
      throw error;
    }
  }

  async checkNodeRegistration(contractAddress: string, nodeId: string): Promise<boolean> {
    if (!this.provider) {
      throw new Error('Blockchain provider not configured');
    }

    const abi = [
      "function isRegistered(bytes32 nodeId) external view returns (bool)"
    ];

    const contract = new ethers.Contract(contractAddress, abi, this.provider);

    try {
      const isRegistered = await contract.isRegistered(nodeId);
      return isRegistered;
    } catch (error: any) {
      this.logger.error(`Failed to check registration status: ${error.message}`);
      throw error;
    }
  }

  async getRegisteredNodeCount(contractAddress: string): Promise<number> {
    if (!this.provider) {
      throw new Error('Blockchain provider not configured');
    }

    const abi = [
      "function getRegisteredNodeCount() external view returns (uint256)"
    ];

    const contract = new ethers.Contract(contractAddress, abi, this.provider);

    try {
      const count = await contract.getRegisteredNodeCount();
      return Number(count);
    } catch (error: any) {
      this.logger.error(`Failed to get registered node count: ${error.message}`);
      throw error;
    }
  }

  isConfigured(): boolean {
    return !!this.wallet;
  }

  getWalletAddress(): string | null {
    return this.wallet?.address || null;
  }
}