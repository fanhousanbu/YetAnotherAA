import { ethers } from "ethers";
import { ServerConfig, EntryPointVersionConfig } from "../config";
import {
  EntryPointVersion,
  ENTRYPOINT_ABI_V6,
  ENTRYPOINT_ABI_V7_V8,
  FACTORY_ABI_V6,
  AIRACCOUNT_FACTORY_ABI,
  ACCOUNT_ABI,
  VALIDATOR_ABI,
} from "../constants/entrypoint";
import { ILogger, ConsoleLogger } from "../interfaces/logger";
import { UserOperation, PackedUserOperation } from "../../core/types";

/**
 * Unified Ethereum provider — replaces NestJS EthereumService.
 * Manages RPC + Bundler providers and contract interactions.
 */
export class EthereumProvider {
  private readonly provider: ethers.JsonRpcProvider;
  private readonly bundlerProvider: ethers.JsonRpcProvider;
  private readonly config: ServerConfig;
  private readonly logger: ILogger;

  constructor(config: ServerConfig) {
    this.config = config;
    this.logger = config.logger ?? new ConsoleLogger("[EthereumProvider]");
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.bundlerProvider = new ethers.JsonRpcProvider(config.bundlerRpcUrl);
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  getBundlerProvider(): ethers.JsonRpcProvider {
    return this.bundlerProvider;
  }

  // ── Config helpers ──────────────────────────────────────────────

  private getVersionConfig(version: EntryPointVersion): EntryPointVersionConfig {
    const map: Record<EntryPointVersion, EntryPointVersionConfig | undefined> = {
      [EntryPointVersion.V0_6]: this.config.entryPoints.v06,
      [EntryPointVersion.V0_7]: this.config.entryPoints.v07,
      [EntryPointVersion.V0_8]: this.config.entryPoints.v08,
    };
    const versionConfig = map[version];
    if (!versionConfig) {
      throw new Error(`EntryPoint version ${version} is not configured`);
    }
    return versionConfig;
  }

  getEntryPointAddress(version: EntryPointVersion): string {
    return this.getVersionConfig(version).entryPointAddress;
  }

  getFactoryAddress(version: EntryPointVersion): string {
    return this.getVersionConfig(version).factoryAddress;
  }

  getValidatorAddress(version: EntryPointVersion): string {
    return this.getVersionConfig(version).validatorAddress;
  }

  getDefaultVersion(): EntryPointVersion {
    const v = this.config.defaultVersion;
    if (v === "0.7") return EntryPointVersion.V0_7;
    if (v === "0.8") return EntryPointVersion.V0_8;
    return EntryPointVersion.V0_6;
  }

  // ── Contract factories ──────────────────────────────────────────

  getFactoryContract(version: EntryPointVersion = EntryPointVersion.V0_6): ethers.Contract {
    const address = this.getFactoryAddress(version);
    const abi = version === EntryPointVersion.V0_6 ? FACTORY_ABI_V6 : AIRACCOUNT_FACTORY_ABI;
    return new ethers.Contract(address, abi, this.provider);
  }

  getEntryPointContract(version: EntryPointVersion = EntryPointVersion.V0_6): ethers.Contract {
    const address = this.getEntryPointAddress(version);
    const abi = version === EntryPointVersion.V0_6 ? ENTRYPOINT_ABI_V6 : ENTRYPOINT_ABI_V7_V8;
    return new ethers.Contract(address, abi, this.provider);
  }

  getValidatorContract(version: EntryPointVersion = EntryPointVersion.V0_6): ethers.Contract {
    const address = this.getValidatorAddress(version);
    return new ethers.Contract(address, VALIDATOR_ABI, this.provider);
  }

  getAccountContract(address: string): ethers.Contract {
    return new ethers.Contract(address, ACCOUNT_ABI, this.provider);
  }

  // ── On-chain queries ────────────────────────────────────────────

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
      const op = userOp as UserOperation;
      const userOpArray = [
        op.sender,
        op.nonce,
        op.initCode || "0x",
        op.callData,
        op.callGasLimit,
        op.verificationGasLimit,
        op.preVerificationGas,
        op.maxFeePerGas,
        op.maxPriorityFeePerGas,
        op.paymasterAndData || "0x",
        "0x", // Always use empty signature for hash calculation
      ];
      return await entryPoint.getUserOpHash(userOpArray);
    } else {
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
        "0x",
      ];
      return await entryPoint.getUserOpHash(packedOpArray);
    }
  }

  // ── Bundler RPC ─────────────────────────────────────────────────

  /**
   * Gas estimation with account-type-aware defaults.
   * M4 AirAccount ECDSA validation needs ~100-150k verification gas,
   * but bundler can't estimate it (AA23 revert on dummy signatures).
   */
  async estimateUserOperationGas(
    userOp: unknown,
    version: EntryPointVersion = EntryPointVersion.V0_6,
    hints?: { needsDeployment?: boolean; isECDSA?: boolean }
  ): Promise<{ callGasLimit: string; verificationGasLimit: string; preVerificationGas: string }> {
    // Account-type-aware verification gas defaults:
    // - Deployment + ECDSA: 500k (factory create + ECDSA sig verification)
    // - Post-deployment ECDSA: 200k (ECDSA verification ~100k + account logic)
    // - Deployment + BLS: 4M (factory + BLS verification is expensive)
    // - Post-deployment BLS: 500k
    const getDefaultVerificationGas = (): bigint => {
      const isDeployment = hints?.needsDeployment ?? false;
      const isECDSA = hints?.isECDSA ?? false;
      if (isDeployment) return isECDSA ? 500_000n : 4_000_000n;
      return isECDSA ? 200_000n : 500_000n;
    };

    try {
      const estimate = await this.bundlerProvider.send("eth_estimateUserOperationGas", [
        userOp,
        this.getEntryPointAddress(version),
      ]);

      // Bundler estimate succeeded — apply 1.5x buffer with account-aware floor
      const rawVerificationGas = BigInt(estimate.verificationGasLimit);
      const buffered = (rawVerificationGas * 3n) / 2n;
      const floor = getDefaultVerificationGas();
      const finalVerificationGas = buffered > floor ? buffered : floor;

      this.logger.log(
        `Gas estimate: bundler=${rawVerificationGas}, buffered=${buffered}, floor=${floor}, final=${finalVerificationGas}`
      );

      return {
        ...estimate,
        verificationGasLimit: "0x" + finalVerificationGas.toString(16),
      };
    } catch (err) {
      const defaultGas = getDefaultVerificationGas();
      this.logger.log(
        `Bundler estimation failed (likely AA23), using default verificationGasLimit=${defaultGas}`
      );
      return {
        callGasLimit: "0x249f0",
        verificationGasLimit: "0x" + defaultGas.toString(16),
        preVerificationGas: "0x11170",
      };
    }
  }

  async sendUserOperation(
    userOp: unknown,
    version: EntryPointVersion = EntryPointVersion.V0_6
  ): Promise<string> {
    return await this.bundlerProvider.send("eth_sendUserOperation", [
      userOp,
      this.getEntryPointAddress(version),
    ]);
  }

  async getUserOperationReceipt(userOpHash: string): Promise<unknown> {
    return await this.bundlerProvider.send("eth_getUserOperationReceipt", [userOpHash]);
  }

  async waitForUserOp(userOpHash: string, maxAttempts: number = 60): Promise<string> {
    const pollInterval = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const receipt = (await this.getUserOperationReceipt(userOpHash)) as Record<
          string,
          unknown
        > | null;
        if (receipt) {
          const txHash =
            (receipt.transactionHash as string) ||
            ((receipt.receipt as Record<string, unknown>)?.transactionHash as string);
          if (txHash) return txHash;
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
      const gasPrice = await this.bundlerProvider.send("pimlico_getUserOperationGasPrice", []);
      return {
        maxFeePerGas: gasPrice.fast.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.fast.maxPriorityFeePerGas,
      };
    } catch {
      try {
        const feeData = await this.provider.getFeeData();
        const baseFee = feeData.maxFeePerGas || ethers.parseUnits("20", "gwei");
        const priorityFee = feeData.maxPriorityFeePerGas || ethers.parseUnits("2", "gwei");
        const maxFeePerGas = (baseFee * 3n) / 2n;
        const maxPriorityFeePerGas = (priorityFee * 3n) / 2n;
        return {
          maxFeePerGas: "0x" + maxFeePerGas.toString(16),
          maxPriorityFeePerGas: "0x" + maxPriorityFeePerGas.toString(16),
        };
      } catch {
        return {
          maxFeePerGas: "0x" + ethers.parseUnits("3", "gwei").toString(16),
          maxPriorityFeePerGas: "0x" + ethers.parseUnits("1", "gwei").toString(16),
        };
      }
    }
  }
}
