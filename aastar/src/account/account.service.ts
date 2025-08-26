import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { DatabaseService } from '../database/database.service';
import { EthereumService } from '../ethereum/ethereum.service';
import { CreateAccountDto } from './dto/create-account.dto';

@Injectable()
export class AccountService {
  constructor(
    private databaseService: DatabaseService,
    private ethereumService: EthereumService,
    private configService: ConfigService,
  ) {}

  async createAccount(userId: string, createAccountDto: CreateAccountDto) {
    // Check if user already has an account
    const existingAccount = this.databaseService.findAccountByUserId(userId);
    if (existingAccount) {
      return existingAccount;
    }

    const factory = this.ethereumService.getFactoryContract();
    const validatorAddress = this.configService.get<string>('VALIDATOR_CONTRACT_ADDRESS');
    
    // Generate a wallet for the user (this will be the owner of the AA account)
    const userWallet = ethers.Wallet.createRandom();
    const salt = createAccountDto.salt || Math.floor(Math.random() * 1000000);

    // Get the predicted account address
    const accountAddress = await factory['getAddress(address,address,bool,uint256)'](
      userWallet.address,
      validatorAddress,
      true, // useAAStarValidator
      salt,
    );

    // Check if account needs to be deployed
    const provider = this.ethereumService.getProvider();
    const code = await provider.getCode(accountAddress);
    
    let deployed = code !== '0x';
    let deploymentTxHash = null;

    if (!deployed && createAccountDto.deploy) {
      // Deploy the account
      const tx = await factory.createAccountWithAAStarValidator(
        userWallet.address,
        validatorAddress,
        true,
        salt,
        {
          maxFeePerGas: ethers.parseUnits('30', 'gwei'),
          maxPriorityFeePerGas: ethers.parseUnits('10', 'gwei'),
        },
      );
      await tx.wait();
      deploymentTxHash = tx.hash;
      deployed = true;

      // Fund the account if requested
      if (createAccountDto.fundAmount) {
        const fundTx = await this.ethereumService.getWallet().sendTransaction({
          to: accountAddress,
          value: ethers.parseEther(createAccountDto.fundAmount),
          maxFeePerGas: ethers.parseUnits('30', 'gwei'),
          maxPriorityFeePerGas: ethers.parseUnits('10', 'gwei'),
        });
        await fundTx.wait();
      }
    }

    // Save account information
    const account = {
      userId,
      address: accountAddress,
      ownerAddress: userWallet.address,
      ownerPrivateKey: userWallet.privateKey, // In production, this should be encrypted
      salt,
      deployed,
      deploymentTxHash,
      validatorAddress,
      createdAt: new Date().toISOString(),
    };

    this.databaseService.saveAccount(account);

    // Return account info without private key
    const { ownerPrivateKey, ...result } = account;
    return result;
  }

  async getAccount(userId: string) {
    const account = this.databaseService.findAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    // Get current balance
    const balance = await this.ethereumService.getBalance(account.address);
    
    // Get nonce
    const nonce = await this.ethereumService.getNonce(account.address);

    const { ownerPrivateKey, ...result } = account;
    return {
      ...result,
      balance,
      nonce: nonce.toString(),
    };
  }

  async getAccountAddress(userId: string): Promise<string> {
    const account = this.databaseService.findAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account.address;
  }

  async getAccountBalance(userId: string) {
    const account = this.databaseService.findAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException('Account not found');
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
      throw new NotFoundException('Account not found');
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
      throw new NotFoundException('Account not found');
    }

    const tx = await this.ethereumService.getWallet().sendTransaction({
      to: account.address,
      value: ethers.parseEther(amount),
      maxFeePerGas: ethers.parseUnits('30', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('10', 'gwei'),
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