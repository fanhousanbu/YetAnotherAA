import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { ethers } from "ethers";
import { bls12_381 as bls } from "@noble/curves/bls12-381";
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
        } catch {
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
      seedNodes = config.discovery?.seedNodes || [];
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
          peer => peer.status === "active" && peer.apiEndpoint && peer.publicKey
        );

        if (activeNodes.length > 0) {
          console.log(`✅ Discovered ${activeNodes.length} active node(s) via gossip network`);

          // Update cache with discovered nodes
          await this.updateSignerNodeCache(activeNodes);

          return activeNodes;
        }
      } catch (error) {
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
      fallbackEndpoints = config.discovery?.fallbackEndpoints || [];
    }

    if (fallbackEndpoints.length > 0) {
      console.log("\nStep 3: Trying fallback endpoints...");

      for (const endpoint of fallbackEndpoints) {
        try {
          console.log(`Trying fallback: ${endpoint}`);
          const response = await axios.get(`${endpoint}/gossip/peers`, { timeout: 5000 });
          const peers = response.data.peers || [];
          const activeNodes = peers.filter(
            peer => peer.status === "active" && peer.apiEndpoint && peer.publicKey
          );

          if (activeNodes.length > 0) {
            console.log(`✅ Found ${activeNodes.length} node(s) via fallback endpoint`);
            await this.updateSignerNodeCache(activeNodes);
            return activeNodes;
          }
        } catch (error) {
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
    } catch (error) {
      console.warn("❌ Failed to update signer node cache:", error.message);
    }
  }

  async generateBLSSignature(userId: string, userOpHash: string): Promise<BlsSignatureData> {
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
        } catch (error) {
          console.error(`  ❌ Failed: ${error.message}`);
          // Continue with other nodes
        }
      }

      if (signerNodeSignatures.length === 0) {
        throw new Error("Failed to get signatures from any BLS signer nodes");
      }

      console.log(`\n✅ Successfully collected ${signerNodeSignatures.length} signature(s)`);

      let aggregatedSignature: string;
      let messagePoint: string;

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
        } catch (error) {
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
        } catch (error) {
          console.error("❌ Failed to get EIP format signature:", error.message);
          throw new Error(`Failed to get signature in EIP format: ${error.message}`);
        }
      }

      // Generate message point using the same method as signer nodes
      try {
        console.log("\n--- Generating Message Point ---");
        const messageBytes = ethers.getBytes(userOpHash);
        const DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";
        const messagePointBLS = await bls.G2.hashToCurve(messageBytes, { DST });
        const messageG2EIP = this.encodeG2Point(messagePointBLS);
        messagePoint = "0x" + Buffer.from(messageG2EIP).toString("hex");

        console.log("✅ Message point generated");
        console.log("Message Point:", messagePoint.substring(0, 40) + "...");
      } catch (error) {
        console.error("❌ Failed to generate message point:", error.message);
        throw new Error(`Failed to generate message point: ${error.message}`);
      }

      // Generate AA signature using user's wallet
      console.log("\n--- Generating AA Signature ---");
      const account = await this.accountService.getAccountByUserId(userId);
      if (!account) {
        throw new Error("User account not found");
      }

      const wallet = await this.authService.getUserWallet(userId);
      const aaSignature = await wallet.signMessage(ethers.getBytes(userOpHash));

      console.log("✅ AA signature generated");
      console.log("AA Address:", account.signerAddress);

      console.log("\n========== BLS SIGNATURE GENERATION COMPLETE ==========");

      return {
        nodeIds: signerNodeIds,
        signature: aggregatedSignature,
        messagePoint: messagePoint,
        aaAddress: account.signerAddress,
        aaSignature: aaSignature,
      };
    } catch (error) {
      console.error("❌ BLS signature generation failed:", error);
      throw new Error(`BLS signature generation failed: ${error.message}`);
    }
  }

  async packSignature(blsData: BlsSignatureData): Promise<string> {
    // Handle new signature format from signer nodes
    if (blsData.signatures && blsData.nodeIds) {
      // New format: pack signatures from signer nodes
      const nodeIdsLength = ethers.solidityPacked(["uint256"], [blsData.nodeIds.length]);
      const nodeIdsBytes = ethers.solidityPacked(
        Array(blsData.nodeIds.length).fill("bytes32"),
        blsData.nodeIds
      );

      return ethers.solidityPacked(
        ["bytes", "bytes", "bytes", "bytes"],
        [nodeIdsLength, nodeIdsBytes, blsData.signature, blsData.messagePoint]
      );
    }

    // Fallback to old format if available
    if (blsData.nodeIds && blsData.aaSignature) {
      const nodeIdsLength = ethers.solidityPacked(["uint256"], [blsData.nodeIds.length]);
      const nodeIdsBytes = ethers.solidityPacked(
        Array(blsData.nodeIds.length).fill("bytes32"),
        blsData.nodeIds
      );

      return ethers.solidityPacked(
        ["bytes", "bytes", "bytes", "bytes", "bytes"],
        [nodeIdsLength, nodeIdsBytes, blsData.signature, blsData.messagePoint, blsData.aaSignature]
      );
    }

    throw new Error("Invalid BLS signature data format");
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

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  private encodeG2Point(point: any): Uint8Array {
    const result = new Uint8Array(256);
    const affine = point.toAffine();

    const x0Bytes = this.hexToBytes(affine.x.c0.toString(16).padStart(96, "0"));
    const x1Bytes = this.hexToBytes(affine.x.c1.toString(16).padStart(96, "0"));
    const y0Bytes = this.hexToBytes(affine.y.c0.toString(16).padStart(96, "0"));
    const y1Bytes = this.hexToBytes(affine.y.c1.toString(16).padStart(96, "0"));

    result.set(x0Bytes, 16);
    result.set(x1Bytes, 80);
    result.set(y0Bytes, 144);
    result.set(y1Bytes, 208);
    return result;
  }
}
