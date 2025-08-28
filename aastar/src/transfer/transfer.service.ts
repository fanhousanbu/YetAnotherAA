import { Injectable, NotFoundException, BadRequestException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { DatabaseService } from "../database/database.service";
import { EthereumService } from "../ethereum/ethereum.service";
import { AccountService } from "../account/account.service";
import { BlsService } from "../bls/bls.service";
import { ExecuteTransferDto } from "./dto/execute-transfer.dto";
import { EstimateGasDto } from "./dto/estimate-gas.dto";
import { UserOperation } from "../common/interfaces/erc4337.interface";

@Injectable()
export class TransferService {
  constructor(
    private databaseService: DatabaseService,
    private ethereumService: EthereumService,
    private accountService: AccountService,
    private blsService: BlsService,
    private configService: ConfigService
  ) {}

  async executeTransfer(userId: string, transferDto: ExecuteTransferDto) {
    // Get user's account
    const account = this.accountService.getAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException("User account not found");
    }

    if (!account.deployed) {
      throw new BadRequestException("Account needs to be deployed first");
    }

    // Build UserOperation
    const userOp = await this.buildUserOperation(
      account.address,
      transferDto.to,
      transferDto.amount,
      transferDto.data || "0x"
    );

    // Get UserOp hash
    const userOpHash = await this.ethereumService.getUserOpHash(userOp);

    // Generate BLS signature using active signer nodes
    const blsData = await this.blsService.generateBLSSignature(userId, userOpHash);

    // Pack signature
    userOp.signature = await this.blsService.packSignature(blsData);

    // Create transfer record
    const transferId = uuidv4();
    const transfer = {
      id: transferId,
      userId,
      from: account.address,
      to: transferDto.to,
      amount: transferDto.amount,
      data: transferDto.data,
      userOpHash,
      status: "pending",
      nodeIndices: [], // Auto-selected by gossip network
      createdAt: new Date().toISOString(),
    };

    this.databaseService.saveTransfer(transfer);

    // Process transfer asynchronously
    this.processTransferAsync(transferId, userOp, account.address, transferDto);

    // Return immediately with transfer ID for tracking
    return {
      success: true,
      transferId,
      userOpHash,
      status: "pending",
      message: "Transfer submitted successfully. Use transferId to check status.",
      from: account.address,
      to: transferDto.to,
      amount: transferDto.amount,
    };
  }

  // Async processing method
  private async processTransferAsync(
    transferId: string,
    userOp: UserOperation,
    from: string,
    transferDto: ExecuteTransferDto
  ) {
    try {
      // Submit UserOp to bundler
      const bundlerUserOpHash = await this.ethereumService.sendUserOperation(
        this.formatUserOpForBundler(userOp)
      );

      // Update transfer status
      this.databaseService.updateTransfer(transferId, {
        bundlerUserOpHash,
        status: "submitted",
        submittedAt: new Date().toISOString(),
      });

      // Wait for transaction
      const txHash = await this.ethereumService.waitForUserOp(bundlerUserOpHash);

      // Update transfer with transaction hash
      this.databaseService.updateTransfer(transferId, {
        transactionHash: txHash,
        status: "completed",
        completedAt: new Date().toISOString(),
      });

      console.log(`Transfer ${transferId} completed with tx: ${txHash}`);
    } catch (error) {
      // Update transfer status to failed
      this.databaseService.updateTransfer(transferId, {
        status: "failed",
        error: error.message,
        failedAt: new Date().toISOString(),
      });

      console.error(`Transfer ${transferId} failed:`, error.message);
    }
  }

  async estimateGas(userId: string, estimateDto: EstimateGasDto) {
    // Get user's account
    const account = this.accountService.getAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException("User account not found");
    }

    // Build UserOperation for estimation
    const userOp = await this.buildUserOperation(
      account.address,
      estimateDto.to,
      estimateDto.amount,
      estimateDto.data || "0x"
    );

    // Format for bundler
    const formattedUserOp = this.formatUserOpForBundler(userOp);

    // Get gas estimates
    const gasEstimates = await this.ethereumService.estimateUserOperationGas(formattedUserOp);

    // Get validator gas estimate for automatic node selection (default 3 nodes)
    const validatorContract = this.ethereumService.getValidatorContract();
    const nodeCount = 3; // Automatic selection uses 3 nodes
    const validatorGasEstimate = await validatorContract.getGasEstimate(nodeCount);

    return {
      callGasLimit: gasEstimates.callGasLimit,
      verificationGasLimit: gasEstimates.verificationGasLimit,
      preVerificationGas: gasEstimates.preVerificationGas,
      validatorGasEstimate: validatorGasEstimate.toString(),
      totalGasEstimate: (
        BigInt(gasEstimates.callGasLimit) +
        BigInt(gasEstimates.verificationGasLimit) +
        BigInt(gasEstimates.preVerificationGas)
      ).toString(),
      maxFeePerGas: ethers.parseUnits("1", "gwei").toString(),
      maxPriorityFeePerGas: ethers.parseUnits("0.1", "gwei").toString(),
    };
  }

  async getTransferStatus(userId: string, transferId: string) {
    const transfer = this.databaseService.findTransferById(transferId);
    if (!transfer || transfer.userId !== userId) {
      throw new NotFoundException("Transfer not found");
    }

    // Add additional status information
    const response: any = { ...transfer };

    // Calculate elapsed time for pending transfers
    if (transfer.status === "pending" || transfer.status === "submitted") {
      const startTime = new Date(transfer.createdAt).getTime();
      const currentTime = new Date().getTime();
      response.elapsedSeconds = Math.floor((currentTime - startTime) / 1000);
    }

    // Add explorer links
    if (transfer.transactionHash) {
      response.explorerUrl = `https://sepolia.etherscan.io/tx/${transfer.transactionHash}`;
    }
    
    if (transfer.bundlerUserOpHash) {
      response.bundlerStatus = "Transaction submitted to bundler";
    }

    // Add status description
    const statusDescriptions = {
      pending: "Preparing transaction and generating signatures",
      submitted: "Transaction submitted to bundler, waiting for confirmation",
      completed: "Transaction confirmed on chain",
      failed: "Transaction failed",
    };
    response.statusDescription = statusDescriptions[transfer.status] || transfer.status;

    return response;
  }

  async getTransferHistory(userId: string, page: number = 1, limit: number = 10) {
    const transfers = this.databaseService.findTransfersByUserId(userId);

    // Sort by createdAt descending
    transfers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedTransfers = transfers.slice(startIndex, endIndex);

    return {
      transfers: paginatedTransfers,
      total: transfers.length,
      page,
      limit,
      totalPages: Math.ceil(transfers.length / limit),
    };
  }

  private async buildUserOperation(
    sender: string,
    to: string,
    amount: string,
    data: string
  ): Promise<UserOperation> {
    const accountContract = this.ethereumService.getAccountContract(sender);
    const nonce = await this.ethereumService.getNonce(sender);

    // Encode execute function call
    const callData = accountContract.interface.encodeFunctionData("execute", [
      to,
      ethers.parseEther(amount),
      data,
    ]);

    // Initial UserOp for gas estimation
    const baseUserOp = {
      sender,
      nonce: "0x" + nonce.toString(16),
      initCode: "0x",
      callData,
      callGasLimit: "0x0",
      verificationGasLimit: "0x0",
      preVerificationGas: "0x0",
      maxFeePerGas: "0x" + ethers.parseUnits("1", "gwei").toString(16),
      maxPriorityFeePerGas: "0x" + ethers.parseUnits("0.1", "gwei").toString(16),
      paymasterAndData: "0x",
      signature: "0x",
    };

    // Estimate gas
    const gasEstimates = await this.ethereumService.estimateUserOperationGas(baseUserOp);

    return {
      sender,
      nonce,
      initCode: "0x",
      callData,
      callGasLimit: BigInt(gasEstimates.callGasLimit),
      verificationGasLimit: BigInt(gasEstimates.verificationGasLimit),
      preVerificationGas: BigInt(gasEstimates.preVerificationGas),
      maxFeePerGas: ethers.parseUnits("1", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("0.1", "gwei"),
      paymasterAndData: "0x",
      signature: "0x",
    };
  }

  private formatUserOpForBundler(userOp: UserOperation): any {
    return {
      sender: userOp.sender,
      nonce: "0x" + userOp.nonce.toString(16),
      initCode: userOp.initCode,
      callData: userOp.callData,
      callGasLimit: "0x" + userOp.callGasLimit.toString(16),
      verificationGasLimit: "0x" + userOp.verificationGasLimit.toString(16),
      preVerificationGas: "0x" + userOp.preVerificationGas.toString(16),
      maxFeePerGas: "0x" + userOp.maxFeePerGas.toString(16),
      maxPriorityFeePerGas: "0x" + userOp.maxPriorityFeePerGas.toString(16),
      paymasterAndData: userOp.paymasterAndData,
      signature: userOp.signature,
    };
  }
}
