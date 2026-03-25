import { Injectable, Inject, BadRequestException } from "@nestjs/common";
import { YAAAServerClient } from "@aastar/airaccount/server";
import { YAAA_SERVER_CLIENT } from "../sdk/sdk.providers";
import { AddressBookService } from "./address-book.service";
import { ExecuteTransferDto } from "./dto/execute-transfer.dto";
import { EstimateGasDto } from "./dto/estimate-gas.dto";

@Injectable()
export class TransferService {
  constructor(
    @Inject(YAAA_SERVER_CLIENT) private client: YAAAServerClient,
    private addressBookService: AddressBookService
  ) {}

  async executeTransfer(userId: string, transferDto: ExecuteTransferDto) {
    if (!transferDto.passkeyAssertion) {
      throw new BadRequestException("Passkey assertion is required for transactions");
    }

    // Pass the Legacy assertion through to the SDK, which forwards it
    // to BLSSignatureService → ISignerAdapter → KmsSigner → KMS SignHash.
    // The Legacy format is reusable, enabling the two ECDSA signs needed for BLS.
    const result = await this.client.transfers.executeTransfer(userId, {
      to: transferDto.to,
      amount: transferDto.amount,
      data: transferDto.data,
      tokenAddress: transferDto.tokenAddress,
      usePaymaster: transferDto.usePaymaster,
      paymasterAddress: transferDto.paymasterAddress,
      paymasterData: transferDto.paymasterData,
      passkeyAssertion: transferDto.passkeyAssertion,
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
