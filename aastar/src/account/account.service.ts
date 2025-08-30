import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import { DatabaseService } from "../database/database.service";
import { EthereumService } from "../ethereum/ethereum.service";
import { AuthService } from "../auth/auth.service";
import { CreateAccountDto } from "./dto/create-account.dto";

@Injectable()
export class AccountService {
  constructor(
    private databaseService: DatabaseService,
    private ethereumService: EthereumService,
    private authService: AuthService,
    private configService: ConfigService
  ) {}

  async createAccount(userId: string, createAccountDto: CreateAccountDto) {
    // Check if user already has an account
    const existingAccount = this.databaseService.findAccountByUserId(userId);
    if (existingAccount) {
      return existingAccount;
    }

    const factory = this.ethereumService.getFactoryContract();
    const validatorAddress = this.configService.get<string>("VALIDATOR_CONTRACT_ADDRESS");

    // Get user's wallet (created during registration)
    const userWallet = this.authService.getUserWallet(userId);
    const provider = this.ethereumService.getProvider();
    const userWalletWithProvider = userWallet.connect(provider);
    const salt = createAccountDto.salt || Math.floor(Math.random() * 1000000);

    // Get the predicted account address
    const accountAddress = await factory["getAddress(address,address,bool,uint256)"](
      userWallet.address,
      validatorAddress,
      true, // useAAStarValidator
      salt
    );

    // Debug logging
    console.log('Account Creation Debug:');
    console.log('- User Wallet Address (Owner):', userWallet.address);
    console.log('- Validator Address:', validatorAddress);
    console.log('- Salt:', salt);
    console.log('- Predicted AA Account Address:', accountAddress);
    console.log('- Factory Contract Address:', factory.target || factory.address);

    // Check if account is already deployed on-chain (this may be slow for RPC calls)
    let deployed = false;
    let deploymentTxHash = null;
    
    try {
      const code = await provider.getCode(accountAddress);
      deployed = code !== "0x";
      console.log('Account deployment check completed:', deployed);
    } catch (error) {
      console.log('Warning: Could not check deployment status:', error.message);
      // Assume not deployed if RPC fails
    }

    // Don't auto-deploy on account creation
    // Deployment will happen on first transaction
    if (deployed) {
      console.log('Account already deployed on-chain:', accountAddress);
    } else {
      console.log('Account will be deployed on first transaction:', accountAddress);
      console.log('Please fund EOA wallet first:', userWallet.address);
    }

    // Save account information
    const account = {
      userId,
      address: accountAddress,
      ownerAddress: userWallet.address,
      salt,
      deployed,
      deploymentTxHash,
      validatorAddress,
      createdAt: new Date().toISOString(),
    };

    this.databaseService.saveAccount(account);

    return account;
  }

  async getAccount(userId: string) {
    console.log('AccountService.getAccount called with userId:', userId);
    const account = this.databaseService.findAccountByUserId(userId);
    console.log('Found account:', account ? 'YES' : 'NO');
    if (!account) {
      console.log('No account found for userId:', userId);
      throw new NotFoundException("Account not found");
    }

    // Get current balance of Smart Account (skip if not deployed to speed up)
    let balance = "0";
    let eoaBalance = "0";
    
    try {
      // Only check balances if we have provider connection
      balance = await this.ethereumService.getBalance(account.address);
      eoaBalance = await this.ethereumService.getBalance(account.ownerAddress);
      console.log('Balances retrieved - Smart Account:', balance, 'EOA:', eoaBalance);
    } catch (error) {
      console.log('Warning: Could not retrieve balances, using defaults:', error.message);
      // Use default values if RPC fails
    }

    // Get nonce
    const nonce = await this.ethereumService.getNonce(account.address);

    const { ownerPrivateKey, ...result } = account;
    const finalResult = {
      ...result,
      balance,
      eoaBalance,
      nonce: nonce.toString(),
    };
    console.log('AccountService returning data:', JSON.stringify(finalResult, null, 2));
    return finalResult;
  }

  async getAccountAddress(userId: string): Promise<string> {
    const account = this.databaseService.findAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException("Account not found");
    }
    return account.address;
  }

  async getAccountBalance(userId: string) {
    const account = this.databaseService.findAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException("Account not found");
    }

    const balance = await this.ethereumService.getBalance(account.address);
    return {
      address: account.address,
      balance,
      balanceInWei: ethers.parseEther(balance).toString(),
    };
  }

  async getAccountNonce(userId: string) {
    const account = this.databaseService.findAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException("Account not found");
    }

    const nonce = await this.ethereumService.getNonce(account.address);
    return {
      address: account.address,
      nonce: nonce.toString(),
    };
  }

  async fundAccount(userId: string, amount: string) {
    const account = this.databaseService.findAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException("Account not found");
    }

    // Use user's wallet for funding
    const userWallet = this.authService.getUserWallet(userId);
    const provider = this.ethereumService.getProvider();
    const userWalletWithProvider = userWallet.connect(provider);
    
    const tx = await userWalletWithProvider.sendTransaction({
      to: account.address,
      value: ethers.parseEther(amount),
      maxFeePerGas: ethers.parseUnits("30", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("10", "gwei"),
    });

    await tx.wait();

    return {
      success: true,
      txHash: tx.hash,
      amount,
      address: account.address,
    };
  }

  getAccountByUserId(userId: string) {
    return this.databaseService.findAccountByUserId(userId);
  }
}
