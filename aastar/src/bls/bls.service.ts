import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { ethers } from "ethers";
// Note: bls12_381 import removed - messagePoint generation now done on-chain
import { DatabaseService } from "../database/database.service";
import { AccountService } from "../account/account.service";
import { AuthService } from "../auth/auth.service";
import { BlsSignatureData } from "../common/interfaces/erc4337.interface";

@Injectable()
export class BlsService implements OnModuleInit {
  private blsConfig: any;

  constructor(
    private databaseService: DatabaseService,
    private accountService: AccountService,
    private authService: AuthService,
    private configService: ConfigService
  ) {}

  async onModuleInit() {
    await this.initBlsConfig();
  }

  private async initBlsConfig() {
    this.blsConfig = await this.databaseService.getBlsConfig();
  }

  async getActiveSignerNodes(): Promise<any[]> {
    if (!this.blsConfig) {
      await this.initBlsConfig();
    }
    const config = this.blsConfig;
    if (!config || !config.signerNodes) {
      throw new Error("BLS configuration not found or invalid");
    }

    console.log("\n========== DISCOVERING ACTIVE SIGNER NODES ==========");

    // Step 1: Try cached nodes first
    console.log("Step 1: Checking cached signer nodes...");
    const cachedNodes = config.signerNodes.nodes || [];
    const activeCachedNodes = [];

    for (const node of cachedNodes) {
      if (node.status === "active" && node.apiEndpoint) {
        try {
          // Quick health check
          const response = await axios.get(`${node.apiEndpoint}/health`, { timeout: 3000 });
          if (response.status === 200) {
            activeCachedNodes.push({
              nodeId: node.nodeId,
              nodeName: node.nodeName,
              apiEndpoint: node.apiEndpoint,
              publicKey: node.publicKey,
              status: "active",
            });
            console.log(`  ✅ ${node.nodeName} (${node.apiEndpoint}) - Active`);
          }
        } catch (error: any) {
          console.log(`  ❌ ${node.nodeName} (${node.apiEndpoint}) - Offline`);
          // Continue checking other nodes
        }
      }
    }

    if (activeCachedNodes.length > 0) {
      console.log(`✅ Found ${activeCachedNodes.length} active cached node(s)`);
      return activeCachedNodes;
    }

    // Step 2: Fallback to seed nodes discovery
    console.log("\nStep 2: No cached nodes available, trying seed nodes...");

    // Check for environment variable overrides
    const seedNodeOverrides = this.configService.get<string>("BLS_SEED_NODES");
    let seedNodes;

    if (seedNodeOverrides) {
      // Parse comma-separated seed nodes from environment
      seedNodes = seedNodeOverrides.split(",").map(endpoint => ({
        endpoint: endpoint.trim(),
      }));
      console.log("Using seed nodes from environment variables");
    } else {
      // Use config file defaults
      seedNodes = config.discovery?.seedNodes || [
        { endpoint: "http://localhost:3001" },
        { endpoint: "http://localhost:3002" },
      ];
    }

    for (const seedNode of seedNodes) {
      try {
        console.log(`Querying seed node: ${seedNode.endpoint}`);
        const response = await axios.get(`${seedNode.endpoint}/gossip/peers`, {
          timeout: config.discovery?.discoveryTimeout || 10000,
        });
        const peers = response.data.peers || [];

        // Filter active peers
        const activeNodes = peers.filter(
          (peer: any) => peer.status === "active" && peer.apiEndpoint && peer.publicKey
        );

        if (activeNodes.length > 0) {
          console.log(`✅ Discovered ${activeNodes.length} active node(s) via gossip network`);

          // Update cache with discovered nodes
          await this.updateSignerNodeCache(activeNodes);

          return activeNodes;
        }
      } catch (error: any) {
        console.log(`  ❌ Seed node ${seedNode.endpoint} failed: ${error.message}`);
        // Continue with next seed node
      }
    }

    // Step 3: Try default fallback endpoints if configured
    const fallbackOverrides = this.configService.get<string>("BLS_FALLBACK_ENDPOINTS");
    let fallbackEndpoints;

    if (fallbackOverrides) {
      // Parse comma-separated fallback endpoints from environment
      fallbackEndpoints = fallbackOverrides.split(",").map(endpoint => endpoint.trim());
      console.log("Using fallback endpoints from environment variables");
    } else {
      // Use config file defaults
      fallbackEndpoints = config.discovery?.fallbackEndpoints || [
        "http://localhost:3001",
        "http://localhost:3002",
      ];
    }

    if (fallbackEndpoints.length > 0) {
      console.log("\nStep 3: Trying fallback endpoints...");

      for (const endpoint of fallbackEndpoints) {
        try {
          console.log(`Trying fallback: ${endpoint}`);
          const response = await axios.get(`${endpoint}/gossip/peers`, { timeout: 5000 });
          const peers = response.data.peers || [];
          const activeNodes = peers.filter(
            (peer: any) => peer.status === "active" && peer.apiEndpoint && peer.publicKey
          );

          if (activeNodes.length > 0) {
            console.log(`✅ Found ${activeNodes.length} node(s) via fallback endpoint`);
            await this.updateSignerNodeCache(activeNodes);
            return activeNodes;
          }
        } catch (error: any) {
          console.log(`  ❌ Fallback ${endpoint} failed: ${error.message}`);
        }
      }
    }

    console.log("❌ No active BLS signer nodes found anywhere");
    throw new Error("No active BLS signer nodes available");
  }

  private async updateSignerNodeCache(discoveredNodes: any[]): Promise<void> {
    try {
      console.log(`📝 Updating bls-config.json with ${discoveredNodes.length} discovered nodes`);

      // Log the discovered nodes
      discoveredNodes.forEach(node => {
        console.log(`  - ${node.nodeName || node.nodeId} at ${node.apiEndpoint}`);
      });

      // Persist to config file using database service
      await this.databaseService.updateSignerNodesCache(discoveredNodes);

      // Also update the in-memory config
      this.blsConfig = await this.databaseService.getBlsConfig();

      console.log("✅ Successfully updated bls-config.json and in-memory cache");
    } catch (error: any) {
      console.warn("❌ Failed to update signer node cache:", error.message);
    }
  }

  async generateBLSSignature(
    userId: string,
    userOpHash: string,
    nodeIndices?: number[]
  ): Promise<BlsSignatureData> {
    // Get active nodes from signer network
    const activeNodes = await this.getActiveSignerNodes();
    if (activeNodes.length < 1) {
      throw new Error("No active BLS signer nodes available");
    }

    console.log("\n========== SIGNER NODE BLS SIGNATURE GENERATION ==========");
    console.log("Message (userOpHash):", userOpHash);
    console.log("Number of active signer nodes:", activeNodes.length);

    // Use up to 3 active nodes for signing
    const selectedNodes = activeNodes.slice(0, Math.min(3, activeNodes.length));
    console.log("Selected nodes for signing:", selectedNodes.length);

    try {
      // Request signatures from selected signer nodes
      const signerNodeSignatures = [];
      const signerNodePublicKeys = [];
      const signerNodeIds = [];

      for (const node of selectedNodes) {
        try {
          console.log(`\nRequesting signature from ${node.apiEndpoint}...`);
          const response = await axios.post(`${node.apiEndpoint}/signature/sign`, {
            message: userOpHash,
          });

          const signatureEIP = response.data.signature;
          const formattedSignatureEIP = signatureEIP.startsWith("0x")
            ? signatureEIP
            : `0x${signatureEIP}`;

          // For aggregation, use compact format if available, otherwise use EIP format
          const signatureForAggregation = response.data.signatureCompact || signatureEIP;
          const formattedSignatureForAggregation = signatureForAggregation.startsWith("0x")
            ? signatureForAggregation
            : `0x${signatureForAggregation}`;

          signerNodeSignatures.push(formattedSignatureForAggregation);
          signerNodePublicKeys.push(response.data.publicKey);
          signerNodeIds.push(response.data.nodeId);

          console.log(`  ✅ Success - NodeId: ${response.data.nodeId}`);
          console.log(`  - Signature (EIP): ${formattedSignatureEIP.substring(0, 40)}...`);
        } catch (error: any) {
          console.error(`  ❌ Failed: ${error.message}`);
          // Continue with other nodes
        }
      }

      if (signerNodeSignatures.length === 0) {
        throw new Error("Failed to get signatures from any BLS signer nodes");
      }

      console.log(`\n✅ Successfully collected ${signerNodeSignatures.length} signature(s)`);

      let aggregatedSignature: string;

      if (signerNodeSignatures.length > 1) {
        // Multiple signatures - use aggregation service
        console.log("\n--- Aggregating Signatures via Signer Node ---");
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

          console.log("✅ Aggregation successful");
          console.log("Aggregated Signature:", aggregatedSignature.substring(0, 40) + "...");
        } catch (error: any) {
          console.error("❌ Failed to aggregate signatures:", error.message);
          throw new Error(`BLS signature aggregation failed: ${error.message}`);
        }
      } else {
        // Single signature - use the first (and only) signature
        console.log("\n--- Using Single Signature ---");

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

          console.log("✅ Using single signature in EIP format");
          console.log("Signature:", aggregatedSignature.substring(0, 40) + "...");
        } catch (error: any) {
          console.error("❌ Failed to get EIP format signature:", error.message);
          throw new Error(`Failed to get signature in EIP format: ${error.message}`);
        }
      }

      // NOTE: messagePoint generation removed - now handled securely on-chain by AAStarValidatorV7
      console.log("\n--- Message Point Generation ---");
      console.log("✅ Message point will be generated on-chain by AAStarValidatorV7 contract");
      console.log("This eliminates the messagePoint tampering attack vector");

      // Generate AA signature using user's wallet
      console.log("\n--- Generating AA Signature ---");
      const account = await this.accountService.getAccountByUserId(userId);
      if (!account) {
        throw new Error("User account not found");
      }

      const wallet = await this.authService.getUserWallet(userId);
      // Sign userOpHash directly - contract will add Ethereum Signed Message prefix
      const aaSignature = await wallet.signMessage(userOpHash);

      console.log("✅ AA signature generated");
      console.log("AA Address:", account.ownerAddress);

      console.log("\n========== BLS SIGNATURE GENERATION COMPLETE ==========");

      return {
        nodeIds: signerNodeIds,
        signature: aggregatedSignature,
        // messagePoint removed: now generated securely on-chain by AAStarValidatorV7
        aaAddress: account.ownerAddress,
        aaSignature: aaSignature,
      };
    } catch (error: any) {
      console.error("❌ BLS signature generation failed:", error);
      throw new Error(`BLS signature generation failed: ${error.message}`);
    }
  }

  async packSignature(blsData: BlsSignatureData): Promise<string> {
    // Secure Format: Pack without messagePoint (generated on-chain by secure AAStarValidator)
    if (blsData.nodeIds && blsData.signature && blsData.aaSignature) {
      const nodeIdsLength = ethers.solidityPacked(["uint256"], [blsData.nodeIds.length]);
      const nodeIdsBytes = ethers.solidityPacked(
        Array(blsData.nodeIds.length).fill("bytes32"),
        blsData.nodeIds
      );

      // Secure format: nodeIds + blsSignature + aaSignature (no messagePoint)
      return ethers.solidityPacked(
        ["bytes", "bytes", "bytes", "bytes"],
        [nodeIdsLength, nodeIdsBytes, blsData.signature, blsData.aaSignature]
      );
    }

    throw new Error(
      "Invalid BLS signature data format - nodeIds, signature, and aaSignature required"
    );
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

  // Note: messagePoint generation methods removed
  // messagePoint now generated securely on-chain by AAStarValidatorV7
}
