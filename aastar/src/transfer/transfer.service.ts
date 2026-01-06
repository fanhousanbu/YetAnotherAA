import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from "@nestjs/common";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { DatabaseService } from "../database/database.service";
import { EthereumService } from "../ethereum/ethereum.service";
import { AccountService } from "../account/account.service";
import { AuthService } from "../auth/auth.service";
import { BlsService } from "../bls/bls.service";
import { PaymasterService } from "../paymaster/paymaster.service";
import { TokenService } from "../token/token.service";
import { AddressBookService } from "./address-book.service";
import { ExecuteTransferDto } from "./dto/execute-transfer.dto";
import { EstimateGasDto } from "./dto/estimate-gas.dto";
import { UserOperation } from "../common/interfaces/erc4337.interface";
import {
  PackedUserOperation,
  packUserOperation,
  unpackUserOperation,
  unpackAccountGasLimits,
  unpackGasFees,
} from "../common/interfaces/erc4337-v7.interface";
import { EntryPointVersion } from "../common/constants/entrypoint.constants";

@Injectable()
export class TransferService {
  constructor(
    private databaseService: DatabaseService,
    private ethereumService: EthereumService,
    private accountService: AccountService,
    private authService: AuthService,
    private blsService: BlsService,
    private paymasterService: PaymasterService,
    private tokenService: TokenService,
    private addressBookService: AddressBookService
  ) {}

  async executeTransfer(userId: string, transferDto: ExecuteTransferDto) {
    console.log("TransferService.executeTransfer called with userId:", userId);
    console.log("Transfer data:", JSON.stringify(transferDto, null, 2));
    console.log("usePaymaster:", transferDto.usePaymaster);
    console.log("paymasterAddress:", transferDto.paymasterAddress);

    // Verify passkey before proceeding with transaction
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

      console.log("Passkey verification successful for transaction");
    } catch (error) {
      console.error("Passkey verification error:", error);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException("Transaction verification failed");
    }

    // Get user's account
    const account = await this.accountService.getAccountByUserId(userId);
    console.log("Account found:", account ? "YES" : "NO");
    if (!account) {
      console.log("No account found for transfer, userId:", userId);
      throw new NotFoundException("User account not found");
    }

    // Check if account needs deployment
    const provider = this.ethereumService.getProvider();
    const code = await provider.getCode(account.address);
    const needsDeployment = code === "0x";

    if (needsDeployment) {
      console.log("Account needs deployment, will deploy with first transaction");
      // The account will be deployed automatically with the first UserOp
      // The initCode in the UserOp will handle deployment
    }

    // Check Smart Account balance and validate transfer amount
    const smartAccountBalance = parseFloat(await this.ethereumService.getBalance(account.address));

    // For token transfers, we only need gas fees, not the transfer amount
    const isTokenTransfer = !!transferDto.tokenAddress;
    const transferAmount = isTokenTransfer ? 0 : parseFloat(transferDto.amount); // Only need ETH for ETH transfers

    // Only check balance if NOT using paymaster
    if (!transferDto.usePaymaster) {
      const minRequiredBalance = 0.0002; // Require at least 0.0002 ETH for gas fees
      const totalNeeded = transferAmount + minRequiredBalance;

      // Check if Smart Account has sufficient balance for transfer + gas fees
      if (smartAccountBalance < totalNeeded) {
        const transferType = isTokenTransfer ? "token" : "ETH";
        const message = `Insufficient balance: Smart Account has ${smartAccountBalance} ETH but needs ${totalNeeded} ETH (${transferAmount} for transfer + ${minRequiredBalance} for gas). Please use a paymaster or add funds to your account.`;
        console.log(message);
        throw new BadRequestException(message);
      }
    } else {
      // When using paymaster, still check if account has enough for the transfer amount itself (for ETH transfers)
      if (!isTokenTransfer && transferAmount > smartAccountBalance) {
        const message = `Insufficient balance for ETH transfer: Account has ${smartAccountBalance} ETH but trying to send ${transferAmount} ETH.`;
        console.log(message);
        throw new BadRequestException(message);
      }
    }

    // Get account version
    const version = (account.entryPointVersion || "0.6") as unknown as EntryPointVersion;

    // Build UserOperation with Paymaster support
    const userOp = await this.buildUserOperation(
      userId,
      account.address,
      transferDto.to,
      transferDto.amount,
      transferDto.data || "0x",
      transferDto.usePaymaster,
      transferDto.paymasterAddress,
      transferDto.paymasterData,
      transferDto.tokenAddress,
      version
    );

    // Log UserOperation before signing
    this.logUserOperation(userOp, version, "BEFORE_SIGNING");

    // Get UserOp hash
    const userOpHash = await this.ethereumService.getUserOpHash(userOp, version);

    // Ensure user has a wallet (EOA) before generating BLS signature
    // This is needed because BLS signature requires signing with the user's wallet
    await this.authService.ensureUserWallet(userId);

    // Generate BLS signature using active signer nodes
    const blsData = await this.blsService.generateBLSSignature(userId, userOpHash);

    // Pack signature
    userOp.signature = await this.blsService.packSignature(blsData);

    // Log UserOperation after signing
    this.logUserOperation(userOp, version, "AFTER_SIGNING");

    // Create transfer record
    const transferId = uuidv4();
    let tokenSymbol = "ETH"; // Default to ETH

    // If it's a token transfer, get the token symbol
    if (transferDto.tokenAddress) {
      try {
        const tokenInfo = await this.tokenService.getTokenInfo(transferDto.tokenAddress);
        tokenSymbol = tokenInfo.symbol;
      } catch (error) {
        console.warn("Failed to get token symbol, using address:", error.message);
        // If we can't get the symbol, use a shortened address as fallback
        tokenSymbol = `${transferDto.tokenAddress.slice(0, 6)}...${transferDto.tokenAddress.slice(-4)}`;
      }
    }

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
      tokenAddress: transferDto.tokenAddress,
      tokenSymbol,
    };

    await this.databaseService.saveTransfer(transfer);

    // Process transfer asynchronously
    this.processTransferAsync(transferId, userOp, account.address, version);

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
    userOp: UserOperation | PackedUserOperation,
    from: string,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ) {
    try {
      // Format and log UserOp for bundler
      const formattedForBundler = this.formatUserOpForBundler(userOp, version);
      this.logFormattedUserOperation(formattedForBundler, version, "FOR_BUNDLER");

      // Submit UserOp to bundler
      const bundlerUserOpHash = await this.ethereumService.sendUserOperation(
        formattedForBundler,
        version
      );

      // Update transfer status
      await this.databaseService.updateTransfer(transferId, {
        bundlerUserOpHash,
        status: "submitted",
        submittedAt: new Date().toISOString(),
      });

      // Wait for transaction
      const txHash = await this.ethereumService.waitForUserOp(bundlerUserOpHash);

      // Update transfer with transaction hash
      await this.databaseService.updateTransfer(transferId, {
        transactionHash: txHash,
        status: "completed",
        completedAt: new Date().toISOString(),
      });

      console.log(`Transfer ${transferId} completed with tx: ${txHash}`);

      // Record successful transfer in address book
      try {
        const transfer = await this.databaseService.findTransferById(transferId);
        if (transfer && transfer.to) {
          await this.addressBookService.recordSuccessfulTransfer(
            transfer.userId,
            transfer.to,
            txHash
          );
          console.log(`Recorded successful transfer to ${transfer.to} in address book`);
        }
      } catch (error) {
        console.error("Failed to record transfer in address book:", error);
        // Don't fail the entire transfer if address book update fails
      }

      // Check if this was a deployment transaction and update account status
      const provider = this.ethereumService.getProvider();
      const code = await provider.getCode(from);
      if (code !== "0x") {
        const accounts = await this.databaseService.getAccounts();
        const account = accounts.find(a => a.address === from);
        if (account && !account.deployed) {
          await this.databaseService.updateAccount(account.userId, {
            deployed: true,
            deploymentTxHash: txHash,
          });
          console.log(`Account ${from} deployed successfully with tx: ${txHash}`);
        }
      }
    } catch (error) {
      // Update transfer status to failed
      await this.databaseService.updateTransfer(transferId, {
        status: "failed",
        error: error.message,
        failedAt: new Date().toISOString(),
      });

      console.error(`Transfer ${transferId} failed:`, error.message);
    }
  }

  async estimateGas(userId: string, estimateDto: EstimateGasDto) {
    // Get user's account
    const account = await this.accountService.getAccountByUserId(userId);
    if (!account) {
      throw new NotFoundException("User account not found");
    }

    // Get account version
    const version = (account.entryPointVersion || "0.6") as unknown as EntryPointVersion;

    // Build UserOperation for estimation (without paymaster for gas estimation)
    const userOp = await this.buildUserOperation(
      userId,
      account.address,
      estimateDto.to,
      estimateDto.amount,
      estimateDto.data || "0x",
      false, // Don't use paymaster for estimation
      undefined,
      undefined,
      (estimateDto as any).tokenAddress, // Support token estimation
      version
    );

    // Format for bundler
    const formattedUserOp = this.formatUserOpForBundler(userOp, version);

    // Get gas estimates
    const gasEstimates = await this.ethereumService.estimateUserOperationGas(
      formattedUserOp,
      version
    );

    // Get current gas prices
    const gasPrices = await this.ethereumService.getUserOperationGasPrice();

    // Get validator gas estimate for automatic node selection (default 3 nodes)
    const validatorContract = this.ethereumService.getValidatorContract(version);
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
      maxFeePerGas: gasPrices.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
    };
  }

  async getTransferStatus(userId: string, transferId: string) {
    const transfer = await this.databaseService.findTransferById(transferId);
    if (!transfer || transfer.userId !== userId) {
      throw new NotFoundException("Transfer not found");
    }

    // Add additional status information
    const response = { ...transfer };

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
    const transfers = await this.databaseService.findTransfersByUserId(userId);

    // Return empty result if no transfers found (this is normal, not an error)
    if (!transfers || transfers.length === 0) {
      return {
        transfers: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

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
    userId: string,
    sender: string,
    to: string,
    amount: string,
    data: string,
    usePaymaster?: boolean,
    paymasterAddress?: string,
    _paymasterData?: string,
    tokenAddress?: string,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<UserOperation | PackedUserOperation> {
    const accountContract = this.ethereumService.getAccountContract(sender);
    const nonce = await this.ethereumService.getNonce(sender, 0, version);

    // Check if account needs deployment
    const provider = this.ethereumService.getProvider();
    const code = await provider.getCode(sender);
    const needsDeployment = code === "0x";

    // Build initCode if account needs deployment
    let initCode = "0x";
    if (needsDeployment) {
      // Get account details to build initCode
      const accounts = await this.databaseService.getAccounts();
      const account = accounts.find(a => a.address === sender);
      if (account) {
        const factory = this.ethereumService.getFactoryContract(version);
        const factoryAddress = await factory.getAddress();

        // Encode factory deployment call
        // v0.7 and v0.8 use "createAccount" method, v0.6 uses "createAccountWithAAStarValidator"
        const methodName =
          version === EntryPointVersion.V0_7 || version === EntryPointVersion.V0_8
            ? "createAccount"
            : "createAccountWithAAStarValidator";

        // Unified architecture: creator = signer
        // This allows the account to be deployed via Paymaster without needing ETH in deployment wallet
        const deployCalldata = factory.interface.encodeFunctionData(methodName, [
          account.signerAddress, // creator = signer (unified architecture)
          account.signerAddress, // signer for AA signature verification
          account.validatorAddress,
          true, // useAAStarValidator
          account.salt,
        ]);

        // initCode = factory address + deployment calldata
        initCode = ethers.concat([factoryAddress, deployCalldata]);
        console.log("Account needs deployment, adding initCode to UserOp");
        console.log(
          "Using unified Creator/Signer architecture - deployment will be sponsored by Paymaster"
        );
      }
    }

    // Encode execute function call
    let callData: string;
    if (tokenAddress) {
      // ERC20 token transfer
      const tokenInfo = await this.tokenService.getTokenInfo(tokenAddress);
      const transferCalldata = this.tokenService.generateTransferCalldata(
        to,
        amount,
        tokenInfo.decimals
      );

      callData = accountContract.interface.encodeFunctionData("execute", [
        tokenAddress, // target is the token contract
        0, // value is 0 for token transfers
        transferCalldata,
      ]);
    } else {
      // ETH transfer
      callData = accountContract.interface.encodeFunctionData("execute", [
        to,
        ethers.parseEther(amount),
        data,
      ]);
    }

    // Get current gas prices
    const gasPrices = await this.ethereumService.getUserOperationGasPrice();

    // Initial UserOp for gas estimation
    const baseUserOp = {
      sender,
      nonce: "0x" + nonce.toString(16),
      initCode,
      callData,
      callGasLimit: "0x0",
      verificationGasLimit: "0x0",
      preVerificationGas: "0x0",
      maxFeePerGas: gasPrices.maxFeePerGas,
      maxPriorityFeePerGas: gasPrices.maxPriorityFeePerGas,
      paymasterAndData: "0x",
      signature: "0x",
    };

    // Add Paymaster data if requested
    let paymasterAndData = "0x";
    if (usePaymaster) {
      try {
        // If a specific paymaster address is provided, use it directly
        if (paymasterAddress) {
          console.log(`Using custom paymaster address: ${paymasterAddress}`);

          // Get paymaster sponsorship data
          const entryPoint = this.ethereumService.getEntryPointContract(version).target as string;

          // Always pass "custom-user-provided" as the name when a specific address is provided
          paymasterAndData = await this.paymasterService.getPaymasterData(
            userId,
            "custom-user-provided",
            baseUserOp,
            entryPoint,
            paymasterAddress // Pass the actual paymaster address
          );
        } else {
          // No specific address provided, try to use a configured paymaster
          const availablePaymasters = await this.paymasterService.getAvailablePaymasters(userId);
          const configuredPaymaster = availablePaymasters.find(pm => pm.configured);

          if (configuredPaymaster) {
            const entryPoint = this.ethereumService.getEntryPointContract(version).target as string;
            paymasterAndData = await this.paymasterService.getPaymasterData(
              userId,
              configuredPaymaster.name,
              baseUserOp,
              entryPoint,
              undefined
            );
          } else {
            throw new BadRequestException(
              "No paymaster configured and no paymaster address provided"
            );
          }
        }

        if (paymasterAndData && paymasterAndData !== "0x") {
          baseUserOp.paymasterAndData = paymasterAndData;
          console.log(`Paymaster configured successfully: ${paymasterAndData.slice(0, 42)}`);
        } else {
          console.error(`Paymaster returned empty data for address: ${paymasterAddress}`);
          throw new BadRequestException(
            `Paymaster failed to provide sponsorship data. The paymaster at ${paymasterAddress} may not be configured correctly or may not support this transaction.`
          );
        }
      } catch (error) {
        console.error(`Paymaster setup failed:`, error.message);
        throw new BadRequestException(`Paymaster setup failed: ${error.message}`);
      }
    }

    // Estimate gas (with paymaster data if applicable)
    const gasEstimates = await this.ethereumService.estimateUserOperationGas(baseUserOp, version);

    const standardUserOp: UserOperation = {
      sender,
      nonce,
      initCode,
      callData,
      callGasLimit: BigInt(gasEstimates.callGasLimit),
      verificationGasLimit: BigInt(gasEstimates.verificationGasLimit),
      preVerificationGas: BigInt(gasEstimates.preVerificationGas),
      maxFeePerGas: BigInt(gasPrices.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(gasPrices.maxPriorityFeePerGas),
      paymasterAndData,
      signature: "0x",
    };

    // Convert to PackedUserOperation for v0.7 and v0.8
    if (version === EntryPointVersion.V0_7 || version === EntryPointVersion.V0_8) {
      return packUserOperation(standardUserOp);
    }

    return standardUserOp;
  }

  private logUserOperation(
    userOp: UserOperation | PackedUserOperation,
    version: EntryPointVersion,
    phase: string
  ) {
    console.log("╔══════════════════════════════════════════════════════════════");
    console.log(`║ 📦 UserOperation Structure - ${phase}`);
    console.log(`║ Version: EntryPoint ${version}`);
    console.log("╠══════════════════════════════════════════════════════════════");

    if (version === EntryPointVersion.V0_6) {
      const op = userOp as UserOperation;
      console.log("║ Standard UserOperation (v0.6):");
      console.log("║");
      console.log(`║ sender:                ${op.sender}`);
      console.log(
        `║ nonce:                 ${typeof op.nonce === "bigint" ? "0x" + op.nonce.toString(16) : op.nonce}`
      );
      console.log(
        `║ initCode:              ${op.initCode === "0x" ? "0x (no deployment)" : op.initCode?.slice(0, 50) + "..."}`
      );
      console.log(`║ callData:              ${op.callData?.slice(0, 50)}...`);
      console.log(
        `║ callGasLimit:          ${typeof op.callGasLimit === "bigint" ? op.callGasLimit.toString() : op.callGasLimit}`
      );
      console.log(
        `║ verificationGasLimit:  ${typeof op.verificationGasLimit === "bigint" ? op.verificationGasLimit.toString() : op.verificationGasLimit}`
      );
      console.log(
        `║ preVerificationGas:    ${typeof op.preVerificationGas === "bigint" ? op.preVerificationGas.toString() : op.preVerificationGas}`
      );
      console.log(
        `║ maxFeePerGas:          ${typeof op.maxFeePerGas === "bigint" ? op.maxFeePerGas.toString() : op.maxFeePerGas}`
      );
      console.log(
        `║ maxPriorityFeePerGas:  ${typeof op.maxPriorityFeePerGas === "bigint" ? op.maxPriorityFeePerGas.toString() : op.maxPriorityFeePerGas}`
      );
      console.log(
        `║ paymasterAndData:      ${op.paymasterAndData === "0x" ? "0x (no paymaster)" : op.paymasterAndData?.slice(0, 50) + "..."}`
      );
      console.log(
        `║ signature:             ${op.signature === "0x" ? "0x (not signed)" : op.signature?.slice(0, 50) + "..."}`
      );
    } else {
      const packedOp = userOp as PackedUserOperation;
      console.log("║ PackedUserOperation (v0.7/v0.8):");
      console.log("║");
      console.log(`║ sender:                ${packedOp.sender}`);
      console.log(
        `║ nonce:                 ${typeof packedOp.nonce === "bigint" ? "0x" + packedOp.nonce.toString(16) : packedOp.nonce}`
      );
      console.log(
        `║ initCode:              ${packedOp.initCode === "0x" ? "0x (no deployment)" : packedOp.initCode?.slice(0, 50) + "..."}`
      );
      console.log(`║ callData:              ${packedOp.callData?.slice(0, 50)}...`);
      console.log(`║ accountGasLimits:      ${packedOp.accountGasLimits}`);
      console.log(
        `║ preVerificationGas:    ${typeof packedOp.preVerificationGas === "bigint" ? packedOp.preVerificationGas.toString() : packedOp.preVerificationGas}`
      );
      console.log(`║ gasFees:               ${packedOp.gasFees}`);
      console.log(
        `║ paymasterAndData:      ${packedOp.paymasterAndData === "0x" ? "0x (no paymaster)" : packedOp.paymasterAndData?.slice(0, 50) + "..."}`
      );
      console.log(
        `║ signature:             ${packedOp.signature === "0x" ? "0x (not signed)" : packedOp.signature?.slice(0, 50) + "..."}`
      );

      // Decode packed values for better visibility
      if (packedOp.accountGasLimits && packedOp.accountGasLimits !== "0x") {
        try {
          const gasLimits = unpackAccountGasLimits(packedOp.accountGasLimits);
          console.log("║");
          console.log("║ Unpacked accountGasLimits:");
          console.log(`║   - verificationGasLimit: ${gasLimits.verificationGasLimit.toString()}`);
          console.log(`║   - callGasLimit: ${gasLimits.callGasLimit.toString()}`);
        } catch (e) {
          // Ignore unpacking errors
        }
      }

      if (packedOp.gasFees && packedOp.gasFees !== "0x") {
        try {
          const gasFees = unpackGasFees(packedOp.gasFees);
          console.log("║");
          console.log("║ Unpacked gasFees:");
          console.log(`║   - maxPriorityFeePerGas: ${gasFees.maxPriorityFeePerGas.toString()}`);
          console.log(`║   - maxFeePerGas: ${gasFees.maxFeePerGas.toString()}`);
        } catch (e) {
          // Ignore unpacking errors
        }
      }
    }

    console.log("╚══════════════════════════════════════════════════════════════");
    console.log("");
  }

  private logFormattedUserOperation(formattedOp: any, version: EntryPointVersion, phase: string) {
    console.log("╔══════════════════════════════════════════════════════════════");
    console.log(`║ 🚀 Formatted UserOperation - ${phase}`);
    console.log(`║ Version: EntryPoint ${version}`);
    console.log("╠══════════════════════════════════════════════════════════════");

    if (version === EntryPointVersion.V0_7 || version === EntryPointVersion.V0_8) {
      console.log("║ Unpacked Format for Bundler (v0.7/v0.8):");
      console.log("║");
      console.log(`║ sender:                        ${formattedOp.sender}`);
      console.log(`║ nonce:                         ${formattedOp.nonce}`);

      if (formattedOp.factory) {
        console.log(`║ factory:                       ${formattedOp.factory}`);
        console.log(`║ factoryData:                   ${formattedOp.factoryData?.slice(0, 50)}...`);
      } else {
        console.log(`║ factory:                       (not deploying)`);
        console.log(`║ factoryData:                   (not deploying)`);
      }

      console.log(`║ callData:                      ${formattedOp.callData?.slice(0, 50)}...`);
      console.log(`║ callGasLimit:                  ${formattedOp.callGasLimit}`);
      console.log(`║ verificationGasLimit:          ${formattedOp.verificationGasLimit}`);
      console.log(`║ preVerificationGas:            ${formattedOp.preVerificationGas}`);
      console.log(`║ maxFeePerGas:                  ${formattedOp.maxFeePerGas}`);
      console.log(`║ maxPriorityFeePerGas:          ${formattedOp.maxPriorityFeePerGas}`);

      if (formattedOp.paymaster) {
        console.log(`║ paymaster:                     ${formattedOp.paymaster}`);
        console.log(
          `║ paymasterVerificationGasLimit: ${formattedOp.paymasterVerificationGasLimit}`
        );
        console.log(
          `║ paymasterPostOpGasLimit:       ${formattedOp.paymasterPostOpGasLimit || "N/A"}`
        );
        console.log(`║ paymasterData:                 ${formattedOp.paymasterData || "0x"}`);
      } else {
        console.log(`║ paymaster:                     (not using paymaster)`);
      }

      console.log(
        `║ signature:                     ${formattedOp.signature === "0x" ? "0x (not signed)" : formattedOp.signature?.slice(0, 50) + "..."}`
      );
    } else {
      console.log("║ Standard Format for Bundler (v0.6):");
      console.log("║");
      console.log(`║ sender:                ${formattedOp.sender}`);
      console.log(`║ nonce:                 ${formattedOp.nonce}`);
      console.log(
        `║ initCode:              ${formattedOp.initCode === "0x" ? "0x (no deployment)" : formattedOp.initCode?.slice(0, 50) + "..."}`
      );
      console.log(`║ callData:              ${formattedOp.callData?.slice(0, 50)}...`);
      console.log(`║ callGasLimit:          ${formattedOp.callGasLimit}`);
      console.log(`║ verificationGasLimit:  ${formattedOp.verificationGasLimit}`);
      console.log(`║ preVerificationGas:    ${formattedOp.preVerificationGas}`);
      console.log(`║ maxFeePerGas:          ${formattedOp.maxFeePerGas}`);
      console.log(`║ maxPriorityFeePerGas:  ${formattedOp.maxPriorityFeePerGas}`);
      console.log(
        `║ paymasterAndData:      ${formattedOp.paymasterAndData === "0x" ? "0x (no paymaster)" : formattedOp.paymasterAndData?.slice(0, 50) + "..."}`
      );
      console.log(
        `║ signature:             ${formattedOp.signature === "0x" ? "0x (not signed)" : formattedOp.signature?.slice(0, 50) + "..."}`
      );
    }

    console.log("╚══════════════════════════════════════════════════════════════");
    console.log("");
  }

  private formatUserOpForBundler(
    userOp: UserOperation | PackedUserOperation,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): any {
    if (version === EntryPointVersion.V0_7 || version === EntryPointVersion.V0_8) {
      // For v0.7/v0.8, we need to send UNPACKED format to Pimlico bundler
      // Even though the contract uses PackedUserOperation, bundlers expect the unpacked format
      const packedOp = userOp as PackedUserOperation;

      // Unpack the gas values
      const gasLimits = unpackAccountGasLimits(packedOp.accountGasLimits);
      const gasFees = unpackGasFees(packedOp.gasFees);

      // Parse initCode to extract factory and factoryData
      let factory: string | undefined;
      let factoryData: string | undefined;
      if (packedOp.initCode && packedOp.initCode !== "0x" && packedOp.initCode.length > 2) {
        factory = packedOp.initCode.slice(0, 42); // First 20 bytes (address)
        if (packedOp.initCode.length > 42) {
          factoryData = "0x" + packedOp.initCode.slice(42);
        }
      }

      // Parse paymasterAndData to extract components
      let paymaster: string | undefined;
      let paymasterVerificationGasLimit: string | undefined;
      let paymasterPostOpGasLimit: string | undefined;
      let paymasterData: string | undefined;

      if (
        packedOp.paymasterAndData &&
        packedOp.paymasterAndData !== "0x" &&
        packedOp.paymasterAndData.length > 2
      ) {
        // First 20 bytes is the paymaster address
        paymaster = packedOp.paymasterAndData.slice(0, 42);

        if (packedOp.paymasterAndData.length >= 74) {
          // Next 16 bytes (32 hex chars) is verification gas limit (not 32 bytes!)
          const verificationGasHex = packedOp.paymasterAndData.slice(42, 74);
          paymasterVerificationGasLimit = "0x" + BigInt("0x" + verificationGasHex).toString(16);
        }

        if (packedOp.paymasterAndData.length >= 106) {
          // Next 16 bytes is post-op gas limit
          const postOpGasHex = packedOp.paymasterAndData.slice(74, 106);
          paymasterPostOpGasLimit = "0x" + BigInt("0x" + postOpGasHex).toString(16);
        }

        if (packedOp.paymasterAndData.length > 106) {
          // Remaining bytes are paymaster data
          paymasterData = "0x" + packedOp.paymasterAndData.slice(106);
        }
      }

      // Build the unpacked UserOperation object for v0.7
      const result: any = {
        sender: packedOp.sender,
        nonce:
          typeof packedOp.nonce === "bigint"
            ? "0x" + packedOp.nonce.toString(16)
            : packedOp.nonce.toString().startsWith("0x")
              ? packedOp.nonce.toString()
              : "0x" + BigInt(packedOp.nonce).toString(16),
        callData: packedOp.callData,
        callGasLimit: "0x" + gasLimits.callGasLimit.toString(16),
        verificationGasLimit: "0x" + gasLimits.verificationGasLimit.toString(16),
        preVerificationGas:
          typeof packedOp.preVerificationGas === "bigint"
            ? "0x" + packedOp.preVerificationGas.toString(16)
            : packedOp.preVerificationGas.toString().startsWith("0x")
              ? packedOp.preVerificationGas.toString()
              : "0x" + BigInt(packedOp.preVerificationGas).toString(16),
        maxFeePerGas: "0x" + gasFees.maxFeePerGas.toString(16),
        maxPriorityFeePerGas: "0x" + gasFees.maxPriorityFeePerGas.toString(16),
        signature: packedOp.signature || "0x",
      };

      // Add optional fields only if they have values
      if (factory) result.factory = factory;
      if (factoryData) result.factoryData = factoryData;

      // For paymaster, we need ALL fields or NONE
      if (paymaster) {
        result.paymaster = paymaster;
        // Always set gas limits for v0.7/v0.8, even if not parsed
        result.paymasterVerificationGasLimit = paymasterVerificationGasLimit || "0x30000";
        result.paymasterPostOpGasLimit = paymasterPostOpGasLimit || "0x30000";
        // paymasterData can be empty
        if (paymasterData && paymasterData !== "0x") {
          result.paymasterData = paymasterData;
        }
      }

      return result;
    }

    // Format standard UserOperation for v0.6
    const standardOp = userOp as UserOperation;
    return {
      sender: standardOp.sender,
      nonce: "0x" + standardOp.nonce.toString(16),
      initCode: standardOp.initCode,
      callData: standardOp.callData,
      callGasLimit: "0x" + standardOp.callGasLimit.toString(16),
      verificationGasLimit: "0x" + standardOp.verificationGasLimit.toString(16),
      preVerificationGas: "0x" + standardOp.preVerificationGas.toString(16),
      maxFeePerGas: "0x" + standardOp.maxFeePerGas.toString(16),
      maxPriorityFeePerGas: "0x" + standardOp.maxPriorityFeePerGas.toString(16),
      paymasterAndData: standardOp.paymasterAndData,
      signature: standardOp.signature,
    };
  }
}
