import {
  Injectable,
  NotFoundException,
  OnModuleInit,
  Logger,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NodeKeyPair, SignerConfig, NodeState } from "../../interfaces/node.interface.js";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { BlsService } from "../bls/bls.service.js";
import { BlockchainService } from "../blockchain/blockchain.service.js";
import { randomBytes, createHash } from "crypto";

@Injectable()
export class NodeService implements OnModuleInit {
  private readonly logger = new Logger(NodeService.name);
  private nodeState: NodeState;
  private nodeStateFilePath: string;
  private contractAddress: string;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => BlsService))
    private blsService: BlsService,
    private blockchainService: BlockchainService
  ) {}

  async onModuleInit() {
    await this.initializeNode();
  }

  private async initializeNode(): Promise<void> {
    this.loadContractAddress();

    if (process.env.NODE_ID) {
      await this.initializeWithSpecificNodeId(process.env.NODE_ID);
    } else if (process.env.NODE_STATE_FILE) {
      await this.initializeWithStateFile(process.env.NODE_STATE_FILE);
    } else {
      await this.initializeWithAutoDiscovery();
    }
  }

  private loadContractAddress(): void {
    // 优先使用环境变量中的合约地址
    this.contractAddress =
      process.env.VALIDATOR_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS || "";

    if (this.contractAddress) {
      this.logger.log(`Using contract address from environment: ${this.contractAddress}`);
      return;
    }

    // 回退到配置文件
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const configPath = join(currentDir, "../../../demo/config.json");

    try {
      const configData = readFileSync(configPath, "utf8");
      const config: SignerConfig = JSON.parse(configData);
      this.contractAddress = config.contractAddress;
      this.logger.log(`Using contract address from config: ${this.contractAddress}`);
    } catch (error: any) {
      this.logger.warn(`Could not load shared config: ${error.message}`);
      this.contractAddress = "";
    }
  }

  private async initializeWithSpecificNodeId(nodeId: string): Promise<void> {
    this.nodeStateFilePath = join(process.cwd(), `node_${nodeId}.json`);

    if (existsSync(this.nodeStateFilePath)) {
      this.loadExistingNodeState();
      this.logger.log(`Loaded existing node state for ${this.nodeState.nodeId}`);
    } else {
      await this.createNewNodeState(nodeId);
      this.logger.log(`Created new node state for ${this.nodeState.nodeId}`);
    }
  }

  private async initializeWithStateFile(stateFilePath: string): Promise<void> {
    this.nodeStateFilePath = stateFilePath;

    if (existsSync(this.nodeStateFilePath)) {
      this.loadExistingNodeState();
      this.logger.log(`Loaded node state from file: ${stateFilePath}`);
    } else {
      throw new Error(`Node state file not found: ${stateFilePath}`);
    }
  }

  private async initializeWithAutoDiscovery(): Promise<void> {
    const existingNodeFiles = this.discoverExistingNodeFiles();

    if (existingNodeFiles.length === 0) {
      const newNodeId = this.generateNodeId();
      this.nodeStateFilePath = join(process.cwd(), `node_${newNodeId}.json`);
      await this.createNewNodeState(newNodeId);
      this.logger.log(`No existing nodes found. Created new node: ${newNodeId}`);
    } else if (existingNodeFiles.length === 1) {
      this.nodeStateFilePath = existingNodeFiles[0];
      this.loadExistingNodeState();
      this.logger.log(`Auto-discovered and loaded node: ${this.nodeState.nodeId}`);
    } else {
      this.logger.error(`Multiple node files found: ${existingNodeFiles.join(", ")}`);
      this.logger.error("Please specify NODE_ID or NODE_STATE_FILE environment variable");
      throw new Error("Ambiguous node selection: multiple node state files found");
    }
  }

  private discoverExistingNodeFiles(): string[] {
    try {
      const files = readdirSync(process.cwd());
      return files
        .filter(file => file.startsWith("node_") && file.endsWith(".json"))
        .map(file => join(process.cwd(), file));
    } catch (error) {
      this.logger.warn(`Error reading directory: ${error}`);
      return [];
    }
  }

  private generateNodeId(): string {
    return "0x" + randomBytes(16).toString("hex");
  }

  private loadExistingNodeState(): void {
    try {
      const stateData = readFileSync(this.nodeStateFilePath, "utf8");
      this.nodeState = JSON.parse(stateData);
    } catch (error: any) {
      throw new Error(`Failed to load node state: ${error.message}`);
    }
  }

  private async createNewNodeState(nodeId: string): Promise<void> {
    const privateKeyBytes = randomBytes(32);
    const privateKey = "0x" + privateKeyBytes.toString("hex");
    const publicKey = await this.blsService.getPublicKeyFromPrivateKey(privateKey);
    const contractNodeId = this.generateContractNodeId(nodeId);

    this.nodeState = {
      nodeId,
      nodeName: `node_${nodeId.substring(2, 8)}`,
      privateKey,
      publicKey,
      contractNodeId,
      registrationStatus: "pending",
      contractAddress: this.contractAddress,
      createdAt: new Date().toISOString(),
      description: `Autonomous node ${nodeId}`,
    };

    this.saveNodeState();
  }

  private generateContractNodeId(nodeId: string): string {
    return "0x" + createHash("sha256").update(nodeId).digest("hex");
  }

  private saveNodeState(): void {
    try {
      writeFileSync(this.nodeStateFilePath, JSON.stringify(this.nodeState, null, 2), "utf8");
    } catch (error: any) {
      throw new Error(`Failed to save node state: ${error.message}`);
    }
  }

  getCurrentNode(): NodeState {
    if (!this.nodeState) {
      throw new Error("Node not initialized");
    }
    return { ...this.nodeState };
  }

  getNodeForSigning(): NodeKeyPair {
    const currentNode = this.getCurrentNode();
    return {
      originalNodeId: currentNode.nodeId,
      contractNodeId: currentNode.contractNodeId,
      nodeName: currentNode.nodeName,
      privateKey: currentNode.privateKey,
      publicKey: currentNode.publicKey,
      registrationStatus: currentNode.registrationStatus,
      description: currentNode.description,
    };
  }

  async registerOnChain(): Promise<{ success: boolean; txHash?: string; message: string }> {
    if (!this.blockchainService.isConfigured()) {
      throw new Error(
        "Blockchain service not configured. Set ETH_PRIVATE_KEY and ETH_RPC_URL environment variables."
      );
    }

    try {
      // Check current registration status on-chain
      const isRegistered = await this.blockchainService.checkNodeRegistration(
        this.contractAddress,
        this.nodeState.contractNodeId
      );

      if (isRegistered) {
        this.nodeState.registrationStatus = "registered";
        this.nodeState.registeredAt = new Date().toISOString();
        this.saveNodeState();

        return {
          success: true,
          message: `Node ${this.nodeState.nodeId} is already registered on-chain`,
        };
      }

      // Perform actual registration
      this.logger.log(`Registering node ${this.nodeState.nodeId} on-chain...`);

      const txHash = await this.blockchainService.registerNodeOnChain(
        this.contractAddress,
        this.nodeState.contractNodeId,
        this.nodeState.publicKey
      );

      if (txHash === "already_registered") {
        this.nodeState.registrationStatus = "registered";
        this.nodeState.registeredAt = new Date().toISOString();
        this.saveNodeState();

        return {
          success: true,
          message: "Node was already registered on-chain",
        };
      }

      // Update local state
      this.nodeState.registrationStatus = "registered";
      this.nodeState.registeredAt = new Date().toISOString();
      this.saveNodeState();

      this.logger.log(`Node ${this.nodeState.nodeId} registered successfully. TX: ${txHash}`);

      return {
        success: true,
        txHash,
        message: `Node registered successfully on-chain`,
      };
    } catch (error: any) {
      this.logger.error(`Failed to register node on-chain: ${error.message}`);

      this.nodeState.registrationStatus = "failed";
      this.saveNodeState();

      return {
        success: false,
        message: `Registration failed: ${error.message}`,
      };
    }
  }

  updateRegistrationStatus(status: "pending" | "registered" | "failed"): void {
    this.nodeState.registrationStatus = status;
    this.saveNodeState();
  }

  getContractAddress(): string {
    return this.contractAddress;
  }

  getNodeState(): NodeState | null {
    return this.nodeState || null;
  }
}
