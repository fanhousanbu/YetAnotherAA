import { Injectable } from "@nestjs/common";
import { ethers } from "ethers";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";

export interface PaymasterConfig {
  id?: string;
  userId?: string;
  name: string;
  address: string;
  apiKey?: string;
  type: "pimlico" | "stackup" | "alchemy" | "custom";
  endpoint?: string;
  createdAt?: string;
}

@Injectable()
export class PaymasterService {
  private provider: ethers.JsonRpcProvider;
  private dataDir: string;

  constructor(private configService: ConfigService) {
    this.provider = new ethers.JsonRpcProvider(
      this.configService.get<string>("ethRpcUrl") || "https://sepolia.infura.io/v3/YOUR_PROJECT_ID"
    );
    this.dataDir = path.join(process.cwd(), "data");

    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Get user paymasters file path
   */
  private getUserPaymastersFilePath(userId: string): string {
    return path.join(this.dataDir, `user-paymasters-${userId}.json`);
  }

  /**
   * Load user paymasters from JSON file
   */
  private async loadUserPaymastersFromFile(userId: string): Promise<PaymasterConfig[]> {
    const filePath = this.getUserPaymastersFilePath(userId);
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Error loading user paymasters from file:", error);
      return [];
    }
  }

  /**
   * Save user paymasters to JSON file
   */
  private async saveUserPaymastersToFile(
    userId: string,
    paymasters: PaymasterConfig[]
  ): Promise<void> {
    const filePath = this.getUserPaymastersFilePath(userId);
    try {
      fs.writeFileSync(filePath, JSON.stringify(paymasters, null, 2));
    } catch (error) {
      console.error("Error saving user paymasters to file:", error);
      throw new Error("Failed to save user paymasters");
    }
  }

  /**
   * Get available paymaster services for a specific user
   */
  async getAvailablePaymasters(
    userId: string
  ): Promise<{ name: string; address: string; configured: boolean }[]> {
    const paymasters = await this.loadUserPaymastersFromFile(userId);
    return paymasters.map(config => ({
      name: config.name,
      address: config.address,
      configured: !!config.apiKey,
    }));
  }

  /**
   * Add a custom paymaster for a specific user
   */
  async addCustomPaymaster(
    userId: string,
    name: string,
    address: string,
    type: "pimlico" | "stackup" | "alchemy" | "custom" = "custom",
    apiKey?: string,
    endpoint?: string
  ): Promise<void> {
    const paymasters = await this.loadUserPaymastersFromFile(userId);

    // Check if paymaster with same name already exists
    const existingIndex = paymasters.findIndex(p => p.name === name);

    const newPaymaster: PaymasterConfig = {
      id: `${userId}-${name}-${Date.now()}`,
      userId,
      name,
      address,
      type,
      apiKey,
      endpoint,
      createdAt: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      // Replace existing paymaster
      paymasters[existingIndex] = newPaymaster;
    } else {
      // Add new paymaster
      paymasters.push(newPaymaster);
    }

    await this.saveUserPaymastersToFile(userId, paymasters);
  }

  /**
   * Remove a custom paymaster for a specific user
   */
  async removeCustomPaymaster(userId: string, name: string): Promise<boolean> {
    const paymasters = await this.loadUserPaymastersFromFile(userId);
    const originalLength = paymasters.length;

    const filteredPaymasters = paymasters.filter(p => p.name !== name);

    if (filteredPaymasters.length < originalLength) {
      await this.saveUserPaymastersToFile(userId, filteredPaymasters);
      return true;
    }

    return false;
  }

  /**
   * Get paymaster sponsorship data
   */
  async getPaymasterData(
    userId: string,
    paymasterName: string,
    userOp: any,
    entryPoint: string,
    customAddress?: string
  ): Promise<string> {
    // Handle custom user-provided paymaster addresses
    if (paymasterName === "custom-user-provided" && customAddress) {
      console.log(`Processing custom paymaster: ${customAddress}`);

      // For custom paymasters without API integration, we need to format the data correctly
      const formattedAddress = customAddress.toLowerCase().startsWith("0x")
        ? customAddress
        : `0x${customAddress}`;

      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(formattedAddress)) {
        throw new Error(`Invalid paymaster address format: ${customAddress}`);
      }

      // For EntryPoint v0.7/v0.8, we need to pack paymaster data with gas limits
      // Check if this is for v0.7 or v0.8 based on the entryPoint address
      const isV07OrV08 =
        entryPoint.toLowerCase() === "0x0000000071727De22E5E9d8BAf0edAc6f37da032".toLowerCase() ||
        entryPoint.toLowerCase() === "0x0576a174D229E3cFA37253523E645A78A0C91B57".toLowerCase();

      if (isV07OrV08) {
        // For v0.7/v0.8, pack the paymaster address with default gas limits
        // Format: paymaster address (20 bytes) + verificationGasLimit (16 bytes) + postOpGasLimit (16 bytes) + data
        const paymasterVerificationGasLimit = BigInt(0x30000); // Default 196608
        const paymasterPostOpGasLimit = BigInt(0x30000); // Default 196608

        // Pack according to v0.7 format
        const packedData = ethers.concat([
          formattedAddress,
          ethers.zeroPadValue(ethers.toBeHex(paymasterVerificationGasLimit), 16),
          ethers.zeroPadValue(ethers.toBeHex(paymasterPostOpGasLimit), 16),
          "0x", // No additional data for simple paymasters
        ]);

        console.log(`Packed paymaster data for v0.7/v0.8: ${packedData.slice(0, 66)}...`);
        return packedData;
      }

      // For v0.6, return just the address
      return formattedAddress;
    }

    const paymasters = await this.loadUserPaymastersFromFile(userId);
    const config = paymasters.find(p => p.name === paymasterName);

    if (!config) {
      throw new Error(`Paymaster ${paymasterName} not found`);
    }

    switch (config.type) {
      case "pimlico":
        if (!config.apiKey) {
          console.warn(`No API key for Pimlico paymaster ${paymasterName}`);
          return "0x";
        }
        return this.getPimlicoPaymasterData(config, userOp, entryPoint);
      case "stackup":
        if (!config.apiKey) {
          console.warn(`No API key for StackUp paymaster ${paymasterName}`);
          return "0x";
        }
        return this.getStackUpPaymasterData(config, userOp, entryPoint);
      case "alchemy":
        if (!config.apiKey) {
          console.warn(`No API key for Alchemy paymaster ${paymasterName}`);
          return "0x";
        }
        return this.getAlchemyPaymasterData(config, userOp, entryPoint);
      case "custom":
        // Check if this is actually Pimlico paymaster by address
        if (
          config.address.toLowerCase() ===
            "0x0000000000325602a77416A16136FDafd04b299f".toLowerCase() &&
          config.apiKey
        ) {
          // Use Pimlico method for Pimlico paymaster
          return this.getPimlicoPaymasterData(
            { ...config, type: "pimlico", endpoint: "https://api.pimlico.io/v2/11155111/rpc" },
            userOp,
            entryPoint
          );
        }
        // For custom paymasters, always return the address (they may work without API keys)
        console.log(`Using custom paymaster ${paymasterName} at address ${config.address}`);
        return config.address;
      default:
        return "0x";
    }
  }

  /**
   * Pimlico Paymaster integration
   */
  private async getPimlicoPaymasterData(
    config: PaymasterConfig,
    userOp: any,
    entryPoint: string
  ): Promise<string> {
    try {
      const url = `${config.endpoint}?apikey=${config.apiKey}`;
      console.log(`Calling Pimlico API at ${url} for entryPoint ${entryPoint}`);

      const response = await globalThis.fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "pm_sponsorUserOperation",
          params: [
            userOp,
            entryPoint,
            {
              // Optional: Add sponsorship policy
              // sponsorshipPolicyId: "sp_my_policy"
            },
          ],
          id: 1,
        }),
      });

      const result = await response.json();
      console.log("Pimlico API response:", JSON.stringify(result, null, 2));

      if (result.error) {
        console.error("Pimlico API error:", result.error);
        throw new Error(
          `Pimlico sponsorship failed: ${result.error.message || JSON.stringify(result.error)}`
        );
      }

      // For EntryPoint v0.7/v0.8, Pimlico returns the data in a different format
      // It may return paymasterAndData or separate fields
      if (result.result) {
        if (result.result.paymasterAndData) {
          console.log(
            `Received paymasterAndData: ${result.result.paymasterAndData.slice(0, 66)}...`
          );
          return result.result.paymasterAndData;
        } else if (result.result.paymaster) {
          // For v0.7/v0.8, might return structured data
          console.log(`Received structured paymaster data`);
          // Need to pack the paymaster data according to EntryPoint v0.7 format
          const paymaster = result.result.paymaster;
          const paymasterVerificationGasLimit =
            result.result.paymasterVerificationGasLimit || "0x30000";
          const paymasterPostOpGasLimit = result.result.paymasterPostOpGasLimit || "0x30000";
          const paymasterData = result.result.paymasterData || "0x";

          // Pack according to v0.7 format: paymaster address + verification gas + postOp gas + data
          const packedData = ethers.concat([
            paymaster,
            ethers.zeroPadValue(ethers.toBeHex(BigInt(paymasterVerificationGasLimit)), 16),
            ethers.zeroPadValue(ethers.toBeHex(BigInt(paymasterPostOpGasLimit)), 16),
            paymasterData,
          ]);

          console.log(`Packed paymasterAndData: ${packedData.slice(0, 66)}...`);
          return packedData;
        }
      }

      throw new Error("Pimlico API did not return valid paymaster data");
    } catch (error: any) {
      console.error("Pimlico paymaster integration error:", error.message);
      throw error;
    }
  }

  /**
   * StackUp Paymaster integration
   */
  private async getStackUpPaymasterData(
    config: PaymasterConfig,
    userOp: any,
    entryPoint: string
  ): Promise<string> {
    try {
      const response = await globalThis.fetch(`${config.endpoint}/${config.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "pm_sponsorUserOperation",
          params: {
            userOperation: userOp,
            entryPoint: entryPoint,
            context: {
              type: "payg", // pay-as-you-go
            },
          },
          id: 1,
        }),
      });

      const result = await response.json();

      if (result.error) {
        return "0x";
      }

      // StackUp returns paymasterAndData directly
      return result.result || "0x";
    } catch (error) {
      return "0x";
    }
  }

  /**
   * Alchemy Gas Manager integration
   */
  private async getAlchemyPaymasterData(
    config: PaymasterConfig,
    userOp: any,
    entryPoint: string
  ): Promise<string> {
    try {
      const response = await globalThis.fetch(`${config.endpoint}/${config.apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "alchemy_requestGasAndPaymasterAndData",
          params: [
            {
              policyId: "default", // Use default gas policy
              entryPoint: entryPoint,
              userOperation: userOp,
            },
          ],
          id: 1,
        }),
      });

      const result = await response.json();

      if (result.error) {
        return "0x";
      }

      return result.result.paymasterAndData || "0x";
    } catch (error) {
      return "0x";
    }
  }

  /**
   * Validate paymaster signature (for verification)
   */
  async validatePaymasterSignature(
    paymasterAndData: string,
    _userOpHash: string
  ): Promise<boolean> {
    if (!paymasterAndData || paymasterAndData === "0x") {
      return false;
    }

    try {
      // Decode paymasterAndData
      // Format: address (20 bytes) + data (variable)
      const paymasterAddress = "0x" + paymasterAndData.slice(2, 42);
      const paymasterData = "0x" + paymasterAndData.slice(42);

      // Here you would implement actual signature validation
      // This is a placeholder - actual implementation depends on paymaster

      return true;
    } catch (error) {
      console.error("Paymaster validation failed:", error);
      return false;
    }
  }

  /**
   * Analyze a transaction to determine if it used a Paymaster
   */
  async analyzeTransaction(txHash: string): Promise<any> {
    try {
      // Get transaction and receipt
      const [tx, receipt] = await Promise.all([
        this.provider.getTransaction(txHash),
        this.provider.getTransactionReceipt(txHash),
      ]);

      if (!tx || !receipt) {
        throw new Error("Transaction not found");
      }

      // Check if it's an ERC-4337 transaction
      const entryPointAddress = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789".toLowerCase();
      const isERC4337 = tx.to?.toLowerCase() === entryPointAddress;

      if (!isERC4337) {
        return {
          txHash,
          isERC4337: false,
          usedPaymaster: false,
          message: "Not an ERC-4337 transaction",
        };
      }

      // Decode handleOps call to extract UserOperation
      let usedPaymaster = false;
      let paymasterAddress: string | null = null;
      let userOpDetails: any = {};

      try {
        // Define handleOps ABI
        const handleOpsABI = [
          "function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address payable beneficiary)",
        ];

        const iface = new ethers.Interface(handleOpsABI);
        const decoded = iface.parseTransaction({ data: tx.data });

        if (decoded && decoded.args[0] && decoded.args[0].length > 0) {
          const userOp = decoded.args[0][0];

          // Check paymasterAndData field
          const paymasterAndData = userOp.paymasterAndData;
          usedPaymaster =
            paymasterAndData && paymasterAndData !== "0x" && paymasterAndData.length > 2;

          if (usedPaymaster && paymasterAndData.length >= 42) {
            // Extract paymaster address (first 20 bytes)
            paymasterAddress = "0x" + paymasterAndData.slice(2, 42);
          }

          userOpDetails = {
            sender: userOp.sender,
            nonce: userOp.nonce.toString(),
            hasInitCode: userOp.initCode && userOp.initCode !== "0x",
            callGasLimit: userOp.callGasLimit.toString(),
            verificationGasLimit: userOp.verificationGasLimit.toString(),
            preVerificationGas: userOp.preVerificationGas.toString(),
            maxFeePerGas: ethers.formatUnits(userOp.maxFeePerGas, "gwei") + " gwei",
            maxPriorityFeePerGas: ethers.formatUnits(userOp.maxPriorityFeePerGas, "gwei") + " gwei",
            paymasterAndDataLength: paymasterAndData.length,
          };
        }
      } catch (decodeError) {
        // Failed to decode UserOperation
      }

      // Analyze who paid for gas
      const gasPaidBy = usedPaymaster
        ? `Paymaster (${paymasterAddress || "Unknown"})`
        : "User's Smart Account";

      // Get bundler info
      const knownBundlers: { [key: string]: string } = {
        "0x3cfb5c0f608819d4e27d97e68b5c7051716b645b": "Pimlico Bundler",
        "0xc03aac639bb21233e0139381970328db8bceeb67": "Alchemy Bundler",
        "0x0a9a234244b89a9352286b17e5ff19a23c8a3b04": "StackUp Bundler",
      };

      const bundlerName = knownBundlers[tx.from.toLowerCase()] || "Unknown Bundler";

      return {
        txHash,
        isERC4337: true,
        usedPaymaster,
        paymasterAddress,
        bundler: {
          address: tx.from,
          name: bundlerName,
        },
        gasInfo: {
          gasUsed: receipt.gasUsed.toString(),
          effectiveGasPrice: ethers.formatUnits(receipt.gasPrice || 0, "gwei") + " gwei",
          totalCost: ethers.formatEther(receipt.gasUsed * (receipt.gasPrice || 0n)) + " ETH",
          paidBy: gasPaidBy,
        },
        userOperation: userOpDetails,
        summary: usedPaymaster
          ? `✅ This transaction used a Paymaster for gas sponsorship`
          : `❌ This transaction did NOT use a Paymaster (user paid for gas)`,
      };
    } catch (error: any) {
      return {
        error: true,
        message: error.message || "Failed to analyze transaction",
        txHash,
      };
    }
  }
}
