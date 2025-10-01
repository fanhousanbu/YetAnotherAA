import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import { DatabaseService } from "../database/database.service";
import { EthereumService } from "../ethereum/ethereum.service";
import { DeploymentWalletService } from "../ethereum/deployment-wallet.service";
import { AuthService } from "../auth/auth.service";
import { CreateAccountDto, EntryPointVersionDto } from "./dto/create-account.dto";
import { EntryPointVersion } from "../common/constants/entrypoint.constants";

@Injectable()
export class AccountService {
  constructor(
    private databaseService: DatabaseService,
    private ethereumService: EthereumService,
    private deploymentWalletService: DeploymentWalletService,
    private authService: AuthService,
    private configService: ConfigService
  ) {}

  async createAccount(userId: string, createAccountDto: CreateAccountDto) {
    // Check if user already has an account with the specified version
    const existingAccounts = await this.databaseService.getAccounts();
    const userAccounts = existingAccounts.filter(a => a.userId === userId);

    // Determine the version to use
    const versionDto = createAccountDto.entryPointVersion || EntryPointVersionDto.V0_6;
    const version = versionDto as unknown as EntryPointVersion;

    // Check if user already has an account with this version
    const existingAccount = userAccounts.find(a => a.entryPointVersion === versionDto);
    if (existingAccount) {
      return existingAccount;
    }

    const factory = this.ethereumService.getFactoryContract(version);
    const validatorAddress =
      this.ethereumService.getValidatorContract(version).target ||
      this.ethereumService.getValidatorContract(version).address;

    // Use deployment wallet as the owner (from .secret file)
    const deploymentWallet = this.deploymentWalletService.getWallet();
    // Get user's wallet address for AA signature verification
    const userWallet = await this.authService.getUserWallet(userId);
    const salt = createAccountDto.salt || Math.floor(Math.random() * 1000000);

    // Get the predicted account address using deployment wallet as creator and user wallet for AA signature
    const accountAddress = await factory["getAddress(address,address,address,bool,uint256)"](
      deploymentWallet.address,
      userWallet.address, // signerAddress for AA signature verification
      validatorAddress,
      true, // useAAStarValidator
      salt
    );

    // Debug logging
    console.log("Account Creation Debug:");
    console.log("- EntryPoint Version:", versionDto);
    console.log("- Deployment Wallet Address (Creator):", deploymentWallet.address);
    console.log("- User Wallet Address (Signer):", userWallet.address);
    console.log("- Validator Address:", validatorAddress);
    console.log("- Salt:", salt);
    console.log("- Predicted AA Account Address:", accountAddress);
    console.log("- Factory Contract Address:", factory.target || factory.address);

    // Check if account is already deployed on-chain (this may be slow for RPC calls)
    let deployed = false;
    let deploymentTxHash = null;

    try {
      const provider = this.ethereumService.getProvider();
      const code = await provider.getCode(accountAddress);
      deployed = code !== "0x";
      console.log("Account deployment check completed:", deployed);
    } catch (error) {
      console.log("Warning: Could not check deployment status:", error.message);
      // Assume not deployed if RPC fails
    }

    // Don't auto-deploy on account creation
    // Deployment will happen on first transaction
    if (deployed) {
      console.log("Account already deployed on-chain:", accountAddress);
    } else {
      console.log("Account will be deployed on first transaction:", accountAddress);
      console.log("Using deployment wallet for gas:", deploymentWallet.address);
    }

    // Save account information
    const account = {
      userId,
      address: accountAddress,
      creatorAddress: deploymentWallet.address, // Use deployment wallet as creator
      signerAddress: userWallet.address, // User wallet for AA signature verification
      salt,
      deployed,
      deploymentTxHash,
      validatorAddress,
      entryPointVersion: versionDto,
      factoryAddress: factory.target || factory.address,
      createdAt: new Date().toISOString(),
    };

    await this.databaseService.saveAccount(account);

    return account;
  }

  async getAccount(userId: string) {
    console.log("AccountService.getAccount called with userId:", userId);
    const account = await this.databaseService.findAccountByUserId(userId);
    console.log("Found account:", account ? "YES" : "NO");
    if (!account) {
      console.log("No account found for userId:", userId);
      return null; // Return null instead of throwing exception for missing accounts
    }

    // Get current balance of Smart Account
    let balance = "0";

    try {
      // Only check Smart Account balance
      balance = await this.ethereumService.getBalance(account.address);
      console.log("Smart Account balance retrieved:", balance);
    } catch (error) {
      console.log(
        "Warning: Could not retrieve Smart Account balance, using default:",
        error.message
      );
      // Use default value if RPC fails
    }

    // Get the version for this account
    const version = (account.entryPointVersion || "0.6") as unknown as EntryPointVersion;

    // Get nonce
    const nonce = await this.ethereumService.getNonce(account.address, 0, version);

    const finalResult = {
      ...account,
      balance,
      nonce: nonce.toString(),
    };
    console.log("AccountService returning data:", JSON.stringify(finalResult, null, 2));
    return finalResult;
  }

  async getAccountAddress(userId: string): Promise<string> {
    const account = await this.databaseService.findAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException("Account not found");
    }
    return account.address;
  }

  async getAccountBalance(userId: string) {
    const account = await this.databaseService.findAccountByUserId(userId);
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
    const account = await this.databaseService.findAccountByUserId(userId);
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
    const account = await this.databaseService.findAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException("Account not found");
    }

    // Use deployment wallet for funding
    const provider = this.ethereumService.getProvider();
    const deploymentWallet = this.deploymentWalletService.getWallet(provider);

    const tx = await deploymentWallet.sendTransaction({
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

  async getAccountByUserId(userId: string) {
    return await this.databaseService.findAccountByUserId(userId);
  }

  async sponsorAccount(userId: string) {
    const account = await this.databaseService.findAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException("Account not found");
    }

    if (account.sponsored) {
      throw new BadRequestException("Account has already been sponsored");
    }

    // Use deployment wallet to sponsor with 0.01 ETH
    const provider = this.ethereumService.getProvider();
    const deploymentWallet = this.deploymentWalletService.getWallet(provider);
    const sponsorAmount = "0.01";

    const tx = await deploymentWallet.sendTransaction({
      to: account.address,
      value: ethers.parseEther(sponsorAmount),
      maxFeePerGas: ethers.parseUnits("30", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("10", "gwei"),
    });

    await tx.wait();

    // Update account to mark as sponsored
    await this.databaseService.updateAccount(userId, {
      sponsored: true,
      sponsorTxHash: tx.hash,
    });

    return {
      success: true,
      txHash: tx.hash,
      amount: sponsorAmount,
      address: account.address,
    };
  }
}
