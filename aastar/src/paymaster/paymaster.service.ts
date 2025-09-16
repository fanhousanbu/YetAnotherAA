import { Injectable } from "@nestjs/common";
import { ethers } from "ethers";
import { ConfigService } from "@nestjs/config";

export interface PaymasterConfig {
  address: string;
  apiKey?: string;
  type: "pimlico" | "stackup" | "alchemy" | "custom";
  endpoint?: string;
}

@Injectable()
export class PaymasterService {
  private paymasters: Map<string, PaymasterConfig> = new Map();
  private provider: ethers.JsonRpcProvider;

  constructor(private configService: ConfigService) {
    this.initializePaymasters();
    this.provider = new ethers.JsonRpcProvider(
      this.configService.get<string>("ethRpcUrl") || "https://sepolia.infura.io/v3/YOUR_PROJECT_ID"
    );
  }

  private initializePaymasters() {
    // Pimlico Paymaster (Sepolia)
    this.paymasters.set("pimlico-sepolia", {
      address: "0x0000000000325602a77416A16136FDafd04b299f",
      type: "pimlico",
      endpoint: "https://api.pimlico.io/v2/11155111/rpc",
      apiKey: process.env.PIMLICO_API_KEY,
    });

    // StackUp Paymaster (Sepolia)
    this.paymasters.set("stackup-sepolia", {
      address: "0x474e0699E6D9d83E94b593e5d57C14da598F6321",
      type: "stackup",
      endpoint: "https://api.stackup.sh/v1/paymaster",
      apiKey: process.env.STACKUP_API_KEY,
    });

    // Alchemy Gas Manager (Sepolia)
    this.paymasters.set("alchemy-sepolia", {
      address: "0x4Fd9098af9ddcB41DA48A1d78F91F1398965addc",
      type: "alchemy",
      endpoint: "https://eth-sepolia.g.alchemy.com/v2",
      apiKey: process.env.ALCHEMY_API_KEY,
    });

    // Add custom paymaster from environment if configured
    if (process.env.PAYMASTER_ADDRESS) {
      // Check if it's Pimlico Paymaster address
      if (
        process.env.PAYMASTER_ADDRESS.toLowerCase() ===
        "0x0000000000325602a77416A16136FDafd04b299f".toLowerCase()
      ) {
        // Override pimlico-sepolia with the actual API key from env
        const pimlicoConfig = this.paymasters.get("pimlico-sepolia");
        if (pimlicoConfig && process.env.PIMLICO_API_KEY) {
          pimlicoConfig.apiKey = process.env.PIMLICO_API_KEY;
        }
      } else {
        // Add as custom paymaster
        this.paymasters.set("custom", {
          address: process.env.PAYMASTER_ADDRESS,
          type: "custom",
          apiKey: process.env.PAYMASTER_API_KEY || process.env.PIMLICO_API_KEY,
        });
      }
    }
  }

  /**
   * Get available paymaster services
   */
  getAvailablePaymasters(): { name: string; address: string; configured: boolean }[] {
    const result = [];
    for (const [name, config] of this.paymasters.entries()) {
      result.push({
        name,
        address: config.address,
        configured: !!config.apiKey,
      });
    }
    return result;
  }

  /**
   * Get paymaster sponsorship data
   */
  async getPaymasterData(
    paymasterName: string,
    userOp: any,
    entryPoint: string,
    customAddress?: string
  ): Promise<string> {
    // Handle custom user-provided paymaster addresses
    if (paymasterName === "custom-user-provided" && customAddress) {
      console.log(`Processing custom paymaster: ${customAddress}`);
      // For custom paymasters without API, just return the address as paymasterAndData
      // This works for simple paymasters that don't require signatures
      return customAddress;
    }

    const config = this.paymasters.get(paymasterName);
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
