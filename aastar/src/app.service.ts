import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BlsService } from "./bls/bls.service";

@Injectable()
export class AppService {
  constructor(
    private configService: ConfigService,
    private blsService: BlsService
  ) {}

  async getHealth() {
    // Check BLS signer nodes status
    let signerNodesStatus = {
      available: 0,
      total: 0,
      nodes: [],
      status: "error" as "error" | "warning" | "ok",
    };

    try {
      const activeNodes = await this.blsService.getActiveSignerNodes();
      signerNodesStatus = {
        available: activeNodes.length,
        total: activeNodes.length,
        nodes: activeNodes.map(node => ({
          nodeId: node.nodeId,
          endpoint: node.apiEndpoint,
          status: node.status,
        })),
        status: activeNodes.length === 0 ? "error" : activeNodes.length === 1 ? "warning" : "ok",
      };
    } catch (error) {
      console.error("Failed to check signer nodes:", error);
      signerNodesStatus.status = "error";
    }

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      services: {
        backend: {
          status: "ok",
          version: "1.0.0",
        },
        signerNodes: signerNodesStatus,
      },
    };
  }

  getInfo() {
    return {
      name: "AAStar API",
      version: "1.0.0",
      description: "ERC-4337 Account Abstraction API with BLS Aggregate Signatures",
      network: "Sepolia",
      contracts: {
        entryPoint: this.configService.get("ENTRY_POINT_ADDRESS"),
        accountFactory: this.configService.get("AASTAR_ACCOUNT_FACTORY_ADDRESS"),
        validator: this.configService.get("VALIDATOR_CONTRACT_ADDRESS"),
      },
    };
  }
}
