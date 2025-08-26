import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";

export interface BlsNode {
  nodeId: string;
  publicKey: string;
  address: string;
  port: number;
  status: "active" | "inactive";
}

export interface SignatureRequest {
  message: string;
  nodeIds?: string[];
}

export interface SignatureResponse {
  nodeId: string;
  signature: string;
  publicKey: string;
  message: string;
}

export interface AggregateSignatureResponse {
  aggregatedSignature: string;
  aggregatedPublicKey: string;
  participatingNodes: string[];
  message: string;
}

@Injectable()
export class BlsService {
  private readonly logger = new Logger(BlsService.name);
  private seedNodeUrl: string;

  constructor(
    private configService: ConfigService,
    private httpService: HttpService
  ) {
    const seedHost = this.configService.get<string>("BLS_SEED_NODE_HOST", "localhost");
    const seedPort = this.configService.get<number>("BLS_SEED_NODE_PORT", 3001);
    this.seedNodeUrl = `http://${seedHost}:${seedPort}`;
  }

  /**
   * 从种子节点获取活跃的BLS节点列表
   */
  async getActiveNodes(): Promise<BlsNode[]> {
    try {
      this.logger.log(`获取活跃节点列表，种子节点: ${this.seedNodeUrl}`);

      const response = await firstValueFrom(
        this.httpService.get(`${this.seedNodeUrl}/gossip/peers`)
      );

      const nodes: BlsNode[] = response.data.peers || [];
      this.logger.log(`发现 ${nodes.length} 个活跃节点`);

      return nodes.filter(node => node.status === "active");
    } catch (error) {
      this.logger.error(`获取节点列表失败: ${error.message}`);
      throw new HttpException(
        `无法获取BLS节点列表: ${error.message}`,
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * 从指定节点获取单个签名
   */
  async getSignatureFromNode(nodeUrl: string, message: string): Promise<SignatureResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${nodeUrl}/signature/sign`, {
          message,
        })
      );

      return response.data;
    } catch (error) {
      this.logger.error(`从节点 ${nodeUrl} 获取签名失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 从多个节点收集签名
   */
  async collectSignatures(
    message: string,
    requiredNodeIds?: string[]
  ): Promise<SignatureResponse[]> {
    try {
      // 获取活跃节点列表
      const activeNodes = await this.getActiveNodes();

      if (activeNodes.length === 0) {
        throw new HttpException("没有可用的BLS签名节点", HttpStatus.SERVICE_UNAVAILABLE);
      }

      // 如果指定了节点ID，过滤出对应节点
      let targetNodes = activeNodes;
      if (requiredNodeIds && requiredNodeIds.length > 0) {
        targetNodes = activeNodes.filter(node => requiredNodeIds.includes(node.nodeId));

        if (targetNodes.length === 0) {
          throw new HttpException(
            `指定的节点ID未找到活跃节点: ${requiredNodeIds.join(", ")}`,
            HttpStatus.BAD_REQUEST
          );
        }
      }

      this.logger.log(`开始从 ${targetNodes.length} 个节点收集签名`);

      // 并行请求所有节点的签名
      const signaturePromises = targetNodes.map(async node => {
        const nodeUrl = `http://${node.address}:${node.port}`;
        try {
          return await this.getSignatureFromNode(nodeUrl, message);
        } catch (error) {
          this.logger.warn(`节点 ${node.nodeId} 签名失败: ${error.message}`);
          return null;
        }
      });

      const signatures = await Promise.all(signaturePromises);
      const validSignatures = signatures.filter(sig => sig !== null) as SignatureResponse[];

      if (validSignatures.length === 0) {
        throw new HttpException("所有节点签名都失败了", HttpStatus.SERVICE_UNAVAILABLE);
      }

      this.logger.log(`成功收集到 ${validSignatures.length} 个签名`);
      return validSignatures;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`收集签名失败: ${error.message}`);
      throw new HttpException(
        `收集BLS签名失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 调用种子节点进行签名聚合
   */
  async aggregateSignatures(
    message: string,
    signatures: SignatureResponse[]
  ): Promise<AggregateSignatureResponse> {
    try {
      this.logger.log(`开始聚合 ${signatures.length} 个签名`);

      const response = await firstValueFrom(
        this.httpService.post(`${this.seedNodeUrl}/signature/aggregate`, {
          message,
          signatures: signatures.map(sig => ({
            nodeId: sig.nodeId,
            signature: sig.signature,
            publicKey: sig.publicKey,
          })),
        })
      );

      this.logger.log("签名聚合完成");
      return response.data;
    } catch (error) {
      this.logger.error(`签名聚合失败: ${error.message}`);
      throw new HttpException(
        `BLS签名聚合失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 完整的BLS签名流程：收集签名 + 聚合
   */
  async signMessage(
    message: string,
    requiredNodeIds?: string[]
  ): Promise<AggregateSignatureResponse> {
    try {
      this.logger.log(`开始BLS签名流程，消息: ${message.substring(0, 10)}...`);

      // 1. 收集签名
      const signatures = await this.collectSignatures(message, requiredNodeIds);

      // 2. 聚合签名
      const aggregatedResult = await this.aggregateSignatures(message, signatures);

      this.logger.log(
        `BLS签名流程完成，参与节点: ${aggregatedResult.participatingNodes.length} 个`
      );
      return aggregatedResult;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`BLS签名流程失败: ${error.message}`);
      throw new HttpException(
        `BLS签名流程失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 健康检查 - 检查种子节点是否可用
   */
  async healthCheck(): Promise<boolean> {
    try {
      await firstValueFrom(this.httpService.get(`${this.seedNodeUrl}/node/info`));
      return true;
    } catch (error) {
      this.logger.warn(`BLS种子节点不可用: ${error.message}`);
      return false;
    }
  }
}
