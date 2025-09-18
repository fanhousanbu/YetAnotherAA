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
      // For custom paymasters without API integration, we need to format the address correctly
      // paymasterAndData format: address (20 bytes) + data (variable)
      // For simple paymasters that don't require additional data, just pad the address
      const formattedAddress = customAddress.toLowerCase().startsWith("0x")
        ? customAddress
        : `0x${customAddress}`;

      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(formattedAddress)) {
        throw new Error(`Invalid paymaster address format: ${customAddress}`);
      }

      // Return just the address for simple paymasters (no additional data or signatures needed)
      // The paymaster contract must be able to sponsor transactions without requiring signatures
      return formattedAddress;
    }

    const paymasters = await this.loadUserPaymastersFromFile(userId);
    const config = paymasters.find(p => p.name === paymasterName);

    if (!config) {
      throw new Error(`Paymaster ${paymasterName} not found`);
    }

    if (!config.apiKey) {
      return "0x";
    }

    switch (config.type) {
      case "pimlico":
        return this.getPimlicoPaymasterData(config, userOp, entryPoint);
      case "stackup":
        return this.getStackUpPaymasterData(config, userOp, entryPoint);
      case "alchemy":
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
        // For other custom paymasters, just return the address
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

      if (result.error) {
        return "0x";
      }

      return result.result?.paymasterAndData || "0x";
    } catch (error) {
      return "0x";
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
