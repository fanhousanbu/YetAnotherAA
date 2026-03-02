import { Injectable, Inject, NotFoundException, BadRequestException } from "@nestjs/common";
import { YAAAServerClient } from "@yaaa/sdk/server";
import { YAAA_SERVER_CLIENT } from "../sdk/sdk.providers";
import { CreateAccountDto, EntryPointVersionDto } from "./dto/create-account.dto";
import { DatabaseService } from "../database/database.service";
import { ethers } from "ethers";

@Injectable()
export class AccountService {
  constructor(
    @Inject(YAAA_SERVER_CLIENT) private client: YAAAServerClient,
    private databaseService: DatabaseService,
  ) {}

  async createAccount(userId: string, createAccountDto: CreateAccountDto) {
    const versionDto = createAccountDto.entryPointVersion || EntryPointVersionDto.V0_6;

    // Map DTO version to SDK EntryPointVersion
    const versionMap: Record<string, '0.6' | '0.7' | '0.8'> = {
      '0.6': '0.6',
      '0.7': '0.7',
      '0.8': '0.8',
    };

    return this.client.accounts.createAccount(userId, {
      entryPointVersion: versionMap[versionDto] as any,
      salt: createAccountDto.salt,
    });
  }

  async getAccount(userId: string) {
    return this.client.accounts.getAccount(userId);
  }

  async getAccountAddress(userId: string): Promise<string> {
    return this.client.accounts.getAccountAddress(userId);
  }

  async getAccountBalance(userId: string) {
    const result = await this.client.accounts.getAccountBalance(userId);
    return {
      address: result.address,
      balance: result.balance,
      balanceInWei: ethers.parseEther(result.balance).toString(),
    };
  }

  async getAccountNonce(userId: string) {
    return this.client.accounts.getAccountNonce(userId);
  }

  async getAccountByUserId(userId: string) {
    return this.client.accounts.getAccountByUserId(userId);
  }

  /**
   * Phase 1: Owner rotation — update the off-chain signerAddress record.
   * The on-chain signer update requires a separate UserOp calling updateSigner().
   */
  async rotateSigner(userId: string, newSignerAddress: string) {
    if (!ethers.isAddress(newSignerAddress)) {
      throw new BadRequestException("Invalid Ethereum address for newSignerAddress");
    }

    const account = await this.databaseService.findAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException("Account not found");
    }

    const oldSignerAddress = account.signerAddress;

    if (oldSignerAddress?.toLowerCase() === newSignerAddress.toLowerCase()) {
      throw new BadRequestException("New signer address is the same as the current signer");
    }

    await this.databaseService.updateAccount(userId, { signerAddress: newSignerAddress });

    return {
      message: "Signer address updated successfully",
      accountAddress: account.address,
      oldSignerAddress,
      newSignerAddress,
      note: "Off-chain record updated. Submit a UserOp calling updateSigner() to synchronize on-chain.",
    };
  }
}
