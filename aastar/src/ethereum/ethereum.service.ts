import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import { UserOperation } from "../common/interfaces/erc4337.interface";
import { PackedUserOperation, packUserOperation } from "../common/interfaces/erc4337-v7.interface";
import {
  EntryPointVersion,
  ENTRYPOINT_ABI_V6,
  ENTRYPOINT_ABI_V7_V8,
  FACTORY_ABI_V6,
  FACTORY_ABI_V7_V8,
} from "../common/constants/entrypoint.constants";

@Injectable()
export class EthereumService {
  private provider: ethers.JsonRpcProvider;
  private bundlerProvider: ethers.JsonRpcProvider;

  // Contract ABIs
  private readonly ACCOUNT_ABI = [
    "function execute(address dest, uint256 value, bytes calldata func) external",
  ];

  private readonly VALIDATOR_ABI = [
    "function getGasEstimate(uint256 nodeCount) external pure returns (uint256 gasEstimate)",
  ];

  constructor(private configService: ConfigService) {
    this.provider = new ethers.JsonRpcProvider(this.configService.get<string>("ethRpcUrl"));
    this.bundlerProvider = new ethers.JsonRpcProvider(
      this.configService.get<string>("bundlerRpcUrl")
    );
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getBundlerProvider(): ethers.JsonRpcProvider {
    return this.bundlerProvider;
  }

  getFactoryContract(version: EntryPointVersion = EntryPointVersion.V0_6): ethers.Contract {
    const address = this.getFactoryAddress(version);
    const abi = version === EntryPointVersion.V0_6 ? FACTORY_ABI_V6 : FACTORY_ABI_V7_V8;
    return new ethers.Contract(address, abi, this.provider);
  }

  getEntryPointContract(version: EntryPointVersion = EntryPointVersion.V0_6): ethers.Contract {
    const address = this.getEntryPointAddress(version);
    const abi = version === EntryPointVersion.V0_6 ? ENTRYPOINT_ABI_V6 : ENTRYPOINT_ABI_V7_V8;
    return new ethers.Contract(address, abi, this.provider);
  }

  getValidatorContract(version: EntryPointVersion = EntryPointVersion.V0_6): ethers.Contract {
    const address = this.getValidatorAddress(version);
    return new ethers.Contract(address, this.VALIDATOR_ABI, this.provider);
  }

  getAccountContract(address: string): ethers.Contract {
    return new ethers.Contract(address, this.ACCOUNT_ABI, this.provider);
  }

  private getEntryPointAddress(version: EntryPointVersion): string {
    switch (version) {
      case EntryPointVersion.V0_7:
        return this.configService.get<string>("entryPointV7Address");
      case EntryPointVersion.V0_8:
        return this.configService.get<string>("entryPointV8Address");
      case EntryPointVersion.V0_6:
      default:
        return this.configService.get<string>("entryPointAddress");
    }
  }

  private getFactoryAddress(version: EntryPointVersion): string {
    switch (version) {
      case EntryPointVersion.V0_7:
        return this.configService.get<string>("aastarAccountFactoryV7Address");
      case EntryPointVersion.V0_8:
        return this.configService.get<string>("aastarAccountFactoryV8Address");
      case EntryPointVersion.V0_6:
      default:
        return this.configService.get<string>("aastarAccountFactoryAddress");
    }
  }

  private getValidatorAddress(version: EntryPointVersion): string {
    switch (version) {
      case EntryPointVersion.V0_7:
        return this.configService.get<string>("validatorContractV7Address");
      case EntryPointVersion.V0_8:
        return this.configService.get<string>("validatorContractV8Address");
      case EntryPointVersion.V0_6:
      default:
        return this.configService.get<string>("validatorContractAddress");
    }
  }

  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  async getNonce(
    accountAddress: string,
    key: number = 0,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<bigint> {
    const entryPoint = this.getEntryPointContract(version);
    return await entryPoint.getNonce(accountAddress, key);
  }

  async getUserOpHash(
    userOp: UserOperation | PackedUserOperation,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<string> {
    const entryPoint = this.getEntryPointContract(version);

    if (version === EntryPointVersion.V0_6) {
      // v0.6: Use standard UserOperation format
      const userOpArray = [
        userOp.sender,
        userOp.nonce,
        userOp.initCode || "0x",
        userOp.callData,
        (userOp as UserOperation).callGasLimit,
        (userOp as UserOperation).verificationGasLimit,
        (userOp as UserOperation).preVerificationGas,
        (userOp as UserOperation).maxFeePerGas,
        (userOp as UserOperation).maxPriorityFeePerGas,
        (userOp as UserOperation).paymasterAndData || "0x",
        "0x", // Always use empty signature for hash calculation
      ];
      return await entryPoint.getUserOpHash(userOpArray);
    } else {
      // v0.7 and v0.8: Use PackedUserOperation format
      const packedOp = userOp as PackedUserOperation;
      const packedOpArray = [
        packedOp.sender,
        packedOp.nonce,
        packedOp.initCode || "0x",
        packedOp.callData,
        packedOp.accountGasLimits,
        packedOp.preVerificationGas,
        packedOp.gasFees,
        packedOp.paymasterAndData || "0x",
        "0x", // Always use empty signature for hash calculation
      ];
      return await entryPoint.getUserOpHash(packedOpArray);
    }
  }

  async estimateUserOperationGas(
    userOp: any,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<any> {
    try {
      return await this.bundlerProvider.send("eth_estimateUserOperationGas", [
        userOp,
        this.getEntryPointAddress(version),
      ]);
    } catch {
      // Return default values if estimation fails
      return {
        callGasLimit: "0x249f0", // 150000
        verificationGasLimit: "0xf4240", // 1000000
        preVerificationGas: "0x11170", // 70000
      };
    }
  }

  async sendUserOperation(
    userOp: any,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<string> {
    return await this.bundlerProvider.send("eth_sendUserOperation", [
      userOp,
      this.getEntryPointAddress(version),
    ]);
  }

  async getUserOperationReceipt(userOpHash: string): Promise<any> {
    return await this.bundlerProvider.send("eth_getUserOperationReceipt", [userOpHash]);
  }

  async waitForUserOp(userOpHash: string, maxAttempts: number = 60): Promise<string> {
    const pollInterval = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const receipt = await this.getUserOperationReceipt(userOpHash);
        if (receipt && (receipt.transactionHash || receipt.receipt?.transactionHash)) {
          return receipt.transactionHash || receipt.receipt?.transactionHash;
        }
      } catch {
        // Continue polling
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error(`UserOp timeout: ${userOpHash}`);
  }

  async getUserOperationGasPrice(): Promise<{
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
  }> {
    try {
      // Try to get gas price from Pimlico
      const gasPrice = await this.bundlerProvider.send("pimlico_getUserOperationGasPrice", []);
      return {
        maxFeePerGas: gasPrice.fast.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.fast.maxPriorityFeePerGas,
      };
    } catch (error) {
      console.warn(
        "Failed to get gas price from pimlico_getUserOperationGasPrice, using fallback:",
        error.message
      );

      try {
        // Fallback: get current gas price from network and apply multiplier
        const feeData = await this.provider.getFeeData();
        const baseFee = feeData.maxFeePerGas || ethers.parseUnits("20", "gwei"); // fallback to 20 gwei
        const priorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits("2", "gwei"); // fallback to 2 gwei

        // Apply 1.5x multiplier for safety
        const maxFeePerGas = (baseFee * 3n) / 2n;
        const maxPriorityFeePerGas = (priorityFee * 3n) / 2n;

        return {
          maxFeePerGas: "0x" + maxFeePerGas.toString(16),
          maxPriorityFeePerGas: "0x" + maxPriorityFeePerGas.toString(16),
        };
      } catch (fallbackError) {
        console.warn(
          "Fallback gas price estimation also failed, using hardcoded values:",
          fallbackError.message
        );

        // Last resort: use higher hardcoded values based on the error message
        return {
          maxFeePerGas: "0x" + ethers.parseUnits("3", "gwei").toString(16), // 3 gwei (higher than 2.088 gwei requirement)
          maxPriorityFeePerGas: "0x" + ethers.parseUnits("1", "gwei").toString(16), // 1 gwei
        };
      }
    }
  }

  // Helper function to detect which version a deployed account is using
  async detectAccountVersion(accountAddress: string): Promise<EntryPointVersion> {
    // Try to detect based on the factory that deployed it
    // This is a simplified approach - in production you might want to
    // store this information in the database or use a different detection method

    // Check if account supports v0.8 executeUserOp function
    try {
      const accountContract = this.getAccountContract(accountAddress);
      const code = await this.provider.getCode(accountAddress);
      if (code && code !== "0x") {
        // Try to call a v0.8-specific function (this is a heuristic)
        // In practice, you might want to check the bytecode or use events
        return EntryPointVersion.V0_6; // Default for now
      }
    } catch {
      // Ignore errors
    }

    return EntryPointVersion.V0_6; // Default to v0.6
  }
}
