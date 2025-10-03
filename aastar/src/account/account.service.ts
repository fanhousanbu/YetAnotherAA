import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import { DatabaseService } from "../database/database.service";
import { EthereumService } from "../ethereum/ethereum.service";
import { AuthService } from "../auth/auth.service";
import { CreateAccountDto, EntryPointVersionDto } from "./dto/create-account.dto";
import { EntryPointVersion } from "../common/constants/entrypoint.constants";

@Injectable()
export class AccountService {
  constructor(
    private databaseService: DatabaseService,
    private ethereumService: EthereumService,
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

    // Get user's wallet address - now used as both creator and signer
    const userWallet = await this.authService.getUserWallet(userId);
    const salt = createAccountDto.salt || Math.floor(Math.random() * 1000000);

    // Get the predicted account address using user wallet as both creator and signer
    // This unifies the architecture - user has full control of their account
    const accountAddress = await factory["getAddress(address,address,address,bool,uint256)"](
      userWallet.address, // creator - now same as signer for unified control
      userWallet.address, // signer - for AA signature verification
      validatorAddress,
      true, // useAAStarValidator
      salt
    );

    // Debug logging
    console.log("Account Creation Debug (Unified Creator/Signer):");
    console.log("- EntryPoint Version:", versionDto);
    console.log("- User Wallet Address (Creator & Signer):", userWallet.address);
    console.log("- Validator Address:", validatorAddress);
    console.log("- Salt:", salt);
    console.log("- Predicted AA Account Address:", accountAddress);
    console.log("- Factory Contract Address:", factory.target || factory.address);
    console.log("- Note: Using unified architecture - Creator = Signer");

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
    // Deployment will happen on first transaction via Paymaster
    if (deployed) {
      console.log("Account already deployed on-chain:", accountAddress);
    } else {
      console.log("Account will be deployed on first transaction:", accountAddress);
      console.log("Deployment will be sponsored by Paymaster (no ETH needed in user wallet)");
    }

    // Save account information (unified architecture - no separate creatorAddress)
    const account = {
      userId,
      address: accountAddress,
      signerAddress: userWallet.address, // Acts as both signer and creator
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

  // fundAccount method removed - not needed with Paymaster
  // Users don't need ETH when all transactions are sponsored by Paymaster

  async getAccountByUserId(userId: string) {
    return await this.databaseService.findAccountByUserId(userId);
  }

  // sponsorAccount method removed - not needed with Paymaster
  // All transactions are sponsored by Paymaster, no need for ETH sponsorship
}
