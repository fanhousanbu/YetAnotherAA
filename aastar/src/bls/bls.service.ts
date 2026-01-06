import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { ethers } from "ethers";
import { BLSManager } from "@yaaa/sdk";
import { DatabaseService } from "../database/database.service";
import { AccountService } from "../account/account.service";
import { AuthService } from "../auth/auth.service";
import { BlsSignatureData } from "../common/interfaces/erc4337.interface";

@Injectable()
export class BlsService implements OnModuleInit {
  private blsConfig: any;
  private blsManager: BLSManager;

  constructor(
    private databaseService: DatabaseService,
    private accountService: AccountService,
    private authService: AuthService,
    private configService: ConfigService
  ) {}

  async onModuleInit() {
    await this.initBlsConfig();

    // Initialize SDK BLSManager
    const seedNodeOverrides = this.configService.get<string>("BLS_SEED_NODES");
    const seedNodes = seedNodeOverrides
      ? seedNodeOverrides.split(",").map(s => s.trim())
      : this.blsConfig?.discovery?.seedNodes?.map((n: any) => n.endpoint) || [];

    this.blsManager = new BLSManager({
      seedNodes,
      discoveryTimeout: this.blsConfig?.discovery?.discoveryTimeout || 10000,
    });
  }

  private async initBlsConfig() {
    this.blsConfig = await this.databaseService.getBlsConfig();
  }

  async getActiveSignerNodes(): Promise<any[]> {
    // Use SDK's BLSManager for node discovery
    const nodes = await this.blsManager.getAvailableNodes();

    if (nodes.length > 0) {
      // Update cache with discovered nodes
      await this.updateSignerNodeCache(nodes);
    }

    return nodes;
  }

  private async updateSignerNodeCache(discoveredNodes: any[]): Promise<void> {
    try {
      // Persist to config file using database service
      await this.databaseService.updateSignerNodesCache(discoveredNodes);

      // Also update the in-memory config
      this.blsConfig = await this.databaseService.getBlsConfig();
    } catch (error) {
      console.warn("Failed to update signer node cache:", error.message);
    }
  }

  async generateBLSSignature(userId: string, userOpHash: string): Promise<BlsSignatureData> {
    // Get active nodes from signer network
    const activeNodes = await this.getActiveSignerNodes();
    if (activeNodes.length < 1) {
      throw new Error("No active BLS signer nodes available");
    }

    // Use up to 3 active nodes for signing
    const selectedNodes = activeNodes.slice(0, Math.min(3, activeNodes.length));

    try {
      // Request signatures from selected signer nodes
      const signerNodeSignatures = [];
      const signerNodePublicKeys = [];
      const signerNodeIds = [];

      for (const node of selectedNodes) {
        try {
          const response = await axios.post(`${node.apiEndpoint}/signature/sign`, {
            message: userOpHash,
          });

          const signatureEIP = response.data.signature;

          // For aggregation, use compact format if available, otherwise use EIP format
          const signatureForAggregation = response.data.signatureCompact || signatureEIP;
          const formattedSignatureForAggregation = signatureForAggregation.startsWith("0x")
            ? signatureForAggregation
            : `0x${signatureForAggregation}`;

          signerNodeSignatures.push(formattedSignatureForAggregation);
          signerNodePublicKeys.push(response.data.publicKey);
          signerNodeIds.push(response.data.nodeId);
        } catch {
          // Continue with other nodes
        }
      }

      if (signerNodeSignatures.length === 0) {
        throw new Error("Failed to get signatures from any BLS signer nodes");
      }

      let aggregatedSignature: string;
      let messagePoint: string;

      if (signerNodeSignatures.length > 1) {
        // Multiple signatures - use aggregation service
        try {
          const aggregateResponse = await axios.post(
            `${selectedNodes[0].apiEndpoint}/signature/aggregate`,
            {
              signatures: signerNodeSignatures,
            }
          );

          aggregatedSignature = aggregateResponse.data.signature.startsWith("0x")
            ? aggregateResponse.data.signature
            : `0x${aggregateResponse.data.signature}`;
        } catch (error) {
          throw new Error(`BLS signature aggregation failed: ${error.message}`);
        }
      } else {
        // Single signature - use the first (and only) signature

        // Get the EIP format of the single signature
        try {
          const singleSignResponse = await axios.post(
            `${selectedNodes[0].apiEndpoint}/signature/sign`,
            {
              message: userOpHash,
            }
          );
          aggregatedSignature = singleSignResponse.data.signature.startsWith("0x")
            ? singleSignResponse.data.signature
            : `0x${singleSignResponse.data.signature}`;
        } catch (error) {
          throw new Error(`Failed to get signature in EIP format: ${error.message}`);
        }
      }

      // Generate message point using SDK's BLSManager
      try {
        messagePoint = await this.blsManager.generateMessagePoint(userOpHash);
      } catch (error) {
        throw new Error(`Failed to generate message point: ${error.message}`);
      }

      // Generate AA signature using user's wallet
      const account = await this.accountService.getAccountByUserId(userId);
      if (!account) {
        throw new Error(`User account not found for userId: ${userId}`);
      }

      // CRITICAL: Get user's wallet - must never fall back to any other wallet
      let wallet: ethers.Wallet;
      try {
        wallet = await this.authService.getUserWallet(userId);

        // Verify wallet address matches the account's signer address
        if (wallet.address.toLowerCase() !== account.signerAddress.toLowerCase()) {
          throw new Error(
            `Critical: Wallet address mismatch! ` +
              `Wallet: ${wallet.address}, Expected: ${account.signerAddress}`
          );
        }
      } catch (error) {
        // NEVER use a fallback wallet - always fail securely
        throw new Error(`Cannot generate signature: ${error.message}`);
      }

      const aaSignature = await wallet.signMessage(ethers.getBytes(userOpHash));

      // Generate messagePoint ECDSA signature using user's wallet
      const messagePointHash = ethers.keccak256(messagePoint);
      const messagePointSignature = await wallet.signMessage(ethers.getBytes(messagePointHash));

      return {
        nodeIds: signerNodeIds,
        signature: aggregatedSignature,
        messagePoint: messagePoint,
        aaAddress: account.signerAddress,
        aaSignature: aaSignature,
        messagePointSignature: messagePointSignature,
      };
    } catch (error) {
      console.error("❌ BLS signature generation failed:", error);
      throw new Error(`BLS signature generation failed: ${error.message}`);
    }
  }

  async packSignature(blsData: BlsSignatureData): Promise<string> {
    // Delegate to SDK's BLSManager
    return this.blsManager.packSignature(blsData);
  }

  async getAvailableNodes() {
    if (!this.blsConfig) {
      await this.initBlsConfig();
    }
    if (!this.blsConfig || !this.blsConfig.signerNodes) {
      return [];
    }

    return this.blsConfig.signerNodes.nodes.map((node, index) => ({
      index: index + 1,
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      apiEndpoint: node.apiEndpoint,
      status: node.status,
      lastSeen: node.lastSeen,
    }));
  }

  async getNodesByIndices(indices: number[]) {
    if (!this.blsConfig) {
      await this.initBlsConfig();
    }
    if (!this.blsConfig || !this.blsConfig.signerNodes) {
      throw new Error("BLS configuration not found");
    }

    return indices.map(i => {
      const node = this.blsConfig.signerNodes.nodes[i - 1];
      if (!node) throw new Error(`Node ${i} not found`);
      return {
        index: i,
        nodeId: node.nodeId,
        nodeName: node.nodeName,
        apiEndpoint: node.apiEndpoint,
        status: node.status,
      };
    });
  }
}
