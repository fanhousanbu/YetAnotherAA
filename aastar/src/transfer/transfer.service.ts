import { Injectable, NotFoundException } from "@nestjs/common";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import { DatabaseService } from "../database/database.service";
import { EthereumService } from "../ethereum/ethereum.service";
import { DeploymentWalletService } from "../ethereum/deployment-wallet.service";
import { AccountService } from "../account/account.service";
import { BlsService } from "../bls/bls.service";
import { PaymasterService } from "../paymaster/paymaster.service";
import { TokenService } from "../token/token.service";
import { ExecuteTransferDto } from "./dto/execute-transfer.dto";
import { EstimateGasDto } from "./dto/estimate-gas.dto";
import { UserOperation } from "../common/interfaces/erc4337.interface";

@Injectable()
export class TransferService {
  constructor(
    private databaseService: DatabaseService,
    private ethereumService: EthereumService,
    private deploymentWalletService: DeploymentWalletService,
    private accountService: AccountService,
    private blsService: BlsService,
    private paymasterService: PaymasterService,
    private tokenService: TokenService
  ) {}

  async executeTransfer(userId: string, transferDto: ExecuteTransferDto) {
    console.log("TransferService.executeTransfer called with userId:", userId);
    console.log("Transfer data:", transferDto);

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
    const transferAmount = parseFloat(transferDto.amount);

    const minRequiredBalance = 0.0002; // Require at least 0.0002 ETH remaining after transfer for gas fees (typical gas cost ~0.0001 ETH)
    const totalNeeded = transferAmount + minRequiredBalance;

    // Check if Smart Account has sufficient balance for transfer + gas fees
    if (smartAccountBalance < totalNeeded) {
      console.log(
        `Smart Account needs prefunding: Current balance ${smartAccountBalance} ETH, needs ${totalNeeded} ETH (${transferAmount} transfer + ${minRequiredBalance} gas)`
      );

      const prefundAmount = Math.max(0.001, totalNeeded - smartAccountBalance + 0.0005); // Add 0.0005 safety margin

      // Use deployment wallet to prefund Smart Account
      const provider = this.ethereumService.getProvider();
      const deploymentWallet = this.deploymentWalletService.getWallet(provider);

      // Send ETH from deployment wallet to Smart Account
      console.log(`Sending ${prefundAmount} ETH from deployment wallet to Smart Account...`);
      const prefundTx = await deploymentWallet.sendTransaction({
        to: account.address,
        value: ethers.parseEther(prefundAmount.toString()),
        maxFeePerGas: ethers.parseUnits("20", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      });

      console.log(`Prefund transaction hash: ${prefundTx.hash}`);
      await prefundTx.wait();
      console.log(`Smart Account prefunded successfully`);
    }

    // Build UserOperation with Paymaster support
    const userOp = await this.buildUserOperation(
      account.address,
      transferDto.to,
      transferDto.amount,
      transferDto.data || "0x",
      transferDto.usePaymaster,
      transferDto.paymasterAddress,
      transferDto.paymasterData,
      transferDto.tokenAddress
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

    await this.databaseService.saveTransfer(transfer);

    // Process transfer asynchronously
    this.processTransferAsync(transferId, userOp, account.address);

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
  private async processTransferAsync(transferId: string, userOp: UserOperation, from: string) {
    try {
      // Submit UserOp to bundler
      const bundlerUserOpHash = await this.ethereumService.sendUserOperation(
        this.formatUserOpForBundler(userOp)
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

    // Build UserOperation for estimation (without paymaster for gas estimation)
    const userOp = await this.buildUserOperation(
      account.address,
      estimateDto.to,
      estimateDto.amount,
      estimateDto.data || "0x",
      false, // Don't use paymaster for estimation
      undefined,
      undefined,
      (estimateDto as any).tokenAddress // Support token estimation
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
    sender: string,
    to: string,
    amount: string,
    data: string,
    usePaymaster?: boolean,
    paymasterAddress?: string,
    _paymasterData?: string,
    tokenAddress?: string
  ): Promise<UserOperation> {
    const accountContract = this.ethereumService.getAccountContract(sender);
    const nonce = await this.ethereumService.getNonce(sender);

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
        const factory = this.ethereumService.getFactoryContract();
        const factoryAddress = await factory.getAddress();

        // Encode factory deployment call
        const deployCalldata = factory.interface.encodeFunctionData(
          "createAccountWithAAStarValidator",
          [
            account.creatorAddress,
            account.signerAddress, // signerAddress for AA signature verification
            account.validatorAddress,
            true, // useAAStarValidator
            account.salt,
          ]
        );

        // initCode = factory address + deployment calldata
        initCode = ethers.concat([factoryAddress, deployCalldata]);
        console.log("Account needs deployment, adding initCode to UserOp");
      }
    }

    // Encode execute function call
    let callData: string;
    if (tokenAddress) {
      // ERC20 token transfer
      const tokenInfo = await this.tokenService.getTokenInfo(tokenAddress);
      const transferCalldata = this.tokenService.generateTransferCalldata(to, amount, tokenInfo.decimals);
      
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

    // Initial UserOp for gas estimation
    const baseUserOp = {
      sender,
      nonce: "0x" + nonce.toString(16),
      initCode,
      callData,
      callGasLimit: "0x0",
      verificationGasLimit: "0x0",
      preVerificationGas: "0x0",
      maxFeePerGas: "0x" + ethers.parseUnits("1", "gwei").toString(16),
      maxPriorityFeePerGas: "0x" + ethers.parseUnits("0.1", "gwei").toString(16),
      paymasterAndData: "0x",
      signature: "0x",
    };

    // Add Paymaster data if requested
    let paymasterAndData = "0x";
    if (usePaymaster) {
      try {
        // Determine which paymaster to use
        let paymasterName = "pimlico-sepolia"; // default to pimlico-sepolia
        
        if (paymasterAddress) {
          // Check if this is a known paymaster
          const availablePaymasters = this.paymasterService.getAvailablePaymasters();
          const knownPaymaster = availablePaymasters.find(
            pm => pm.address.toLowerCase() === paymasterAddress.toLowerCase()
          );
          if (knownPaymaster) {
            paymasterName = knownPaymaster.name;
          }
        } else {
          // Use the first configured paymaster (prefer pimlico-sepolia)
          const availablePaymasters = this.paymasterService.getAvailablePaymasters();
          const pimlicoPaymaster = availablePaymasters.find(pm => pm.name === "pimlico-sepolia" && pm.configured);
          if (pimlicoPaymaster) {
            paymasterName = "pimlico-sepolia";
          } else {
            const configuredPaymaster = availablePaymasters.find(pm => pm.configured);
            if (configuredPaymaster) {
              paymasterName = configuredPaymaster.name;
            }
          }
        }

        // Get paymaster sponsorship data
        const entryPoint = this.ethereumService.getEntryPointContract().target as string;
        paymasterAndData = await this.paymasterService.getPaymasterData(
          paymasterName,
          baseUserOp,
          entryPoint
        );
        
        if (paymasterAndData !== "0x") {
          baseUserOp.paymasterAndData = paymasterAndData;
        }
      } catch (error) {
        // Continue without paymaster if setup fails
      }
    }

    // Estimate gas (with paymaster data if applicable)
    const gasEstimates = await this.ethereumService.estimateUserOperationGas(baseUserOp);

    return {
      sender,
      nonce,
      initCode,
      callData,
      callGasLimit: BigInt(gasEstimates.callGasLimit),
      verificationGasLimit: BigInt(gasEstimates.verificationGasLimit),
      preVerificationGas: BigInt(gasEstimates.preVerificationGas),
      maxFeePerGas: ethers.parseUnits("1", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("0.1", "gwei"),
      paymasterAndData,
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
