import { Injectable, Inject, BadRequestException, UnauthorizedException } from "@nestjs/common";
import { YAAAServerClient } from "@yaaa/sdk/server";
import { YAAA_SERVER_CLIENT } from "../sdk/sdk.providers";
import { AuthService } from "../auth/auth.service";
import { AddressBookService } from "./address-book.service";
import { ExecuteTransferDto } from "./dto/execute-transfer.dto";
import { EstimateGasDto } from "./dto/estimate-gas.dto";

@Injectable()
export class TransferService {
  constructor(
    @Inject(YAAA_SERVER_CLIENT) private client: YAAAServerClient,
    private authService: AuthService,
    private addressBookService: AddressBookService
  ) {}

  async executeTransfer(userId: string, transferDto: ExecuteTransferDto) {
    // Verify passkey before proceeding (backend-specific, SDK doesn't handle auth)
    if (!transferDto.passkeyCredential) {
      throw new BadRequestException("Passkey verification is required for transactions");
    }

    try {
      const verification = await this.authService.completeTransactionVerification(
        userId,
        transferDto.passkeyCredential
      );

      if (!verification.verified) {
        throw new UnauthorizedException("Passkey verification failed");
      }
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new UnauthorizedException("Transaction verification failed");
    }

    // Delegate to SDK for core transfer logic
    const result = await this.client.transfers.executeTransfer(userId, {
      to: transferDto.to,
      amount: transferDto.amount,
      data: transferDto.data,
      tokenAddress: transferDto.tokenAddress,
      usePaymaster: transferDto.usePaymaster,
      paymasterAddress: transferDto.paymasterAddress,
      paymasterData: transferDto.paymasterData,
    });

    // Record in address book after successful submission (fire-and-forget)
    if (result.success && result.transferId) {
      this.recordAddressBookEntry(userId, transferDto.to, result.transferId).catch(err => {
        console.error("Failed to record transfer in address book:", err);
      });
    }

    return result;
  }

  async estimateGas(userId: string, estimateDto: EstimateGasDto) {
    return this.client.transfers.estimateGas(userId, {
      to: estimateDto.to,
      amount: estimateDto.amount,
      data: estimateDto.data,
      tokenAddress: (estimateDto as any).tokenAddress,
    });
  }

  async getTransferStatus(userId: string, transferId: string) {
    return this.client.transfers.getTransferStatus(userId, transferId);
  }

  async getTransferHistory(userId: string, page: number = 1, limit: number = 10) {
    return this.client.transfers.getTransferHistory(userId, page, limit);
  }

  private async recordAddressBookEntry(
    userId: string,
    to: string,
    transferId: string
  ): Promise<void> {
    try {
      // Wait a bit for the transfer to potentially complete
      await new Promise(resolve => setTimeout(resolve, 5000));
      const status = await this.client.transfers.getTransferStatus(userId, transferId);
      if (status && (status as any).transactionHash) {
        await this.addressBookService.recordSuccessfulTransfer(
          userId,
          to,
          (status as any).transactionHash
        );
      }
    } catch {
      // Address book update is best-effort
    }
  }
}
