import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlsNode } from '../../interfaces/bls-node.interface';

@Injectable()
export class BlsNodeDiscoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BlsNodeDiscoveryService.name);
  
  private knownNodes = new Map<string, BlsNode>();
  private signerNodes: string[] = [];
  private healthCheckInterval: NodeJS.Timeout;
  private discoveryInterval: NodeJS.Timeout;
  private reconnectInterval: NodeJS.Timeout;
  
  private stats = {
    totalNodes: 0,
    activeNodes: 0,
    suspectedNodes: 0,
    discoveryRounds: 0,
    lastDiscoveryTime: null as Date | null,
  };

  private readonly config = {
    discoveryInterval: 30000,      // 30 seconds
    healthCheckInterval: 15000,    // 15 seconds
    reconnectInterval: 60000,      // 60 seconds
    nodeTimeout: 45000,           // 45 seconds
  };
  
  constructor(private configService: ConfigService) {
    // 获取BLS signer节点列表
    this.signerNodes = this.configService.get('discovery.signerNodes') || [
      'http://localhost:3001',
      'http://localhost:3002', 
      'http://localhost:3003',
    ];

    // 更新配置参数
    this.config.discoveryInterval = this.configService.get('discovery.discoveryInterval') || this.config.discoveryInterval;
    this.config.healthCheckInterval = this.configService.get('discovery.healthCheckInterval') || this.config.healthCheckInterval;
    this.config.reconnectInterval = this.configService.get('discovery.reconnectInterval') || this.config.reconnectInterval;
    this.config.nodeTimeout = this.configService.get('discovery.nodeTimeout') || this.config.nodeTimeout;
  }

  async onModuleInit() {
    this.logger.log('🔍 Starting BLS Node Discovery Service...');
    await this.initializeNodeDiscovery();
    this.startHealthCheck();
    this.startPeriodicDiscovery();
    this.startReconnectLoop();
  }

  async onModuleDestroy() {
    this.stopAllIntervals();
  }

  /**
   * 获取当前可用的BLS节点列表
   */
  async getAvailableNodes(): Promise<BlsNode[]> {
    const activeNodes = Array.from(this.knownNodes.values())
      .filter(node => node.status === 'active')
      .filter(node => this.isNodeHealthy(node));

    this.logger.log(`📊 Found ${activeNodes.length} active BLS nodes`);
    return activeNodes;
  }

  /**
   * 选择指定数量的节点进行签名
   */
  async selectSigners(count: number = 3): Promise<BlsNode[]> {
    const availableNodes = await this.getAvailableNodes();
    
    if (availableNodes.length < count) {
      throw new Error(`Insufficient signers: need ${count}, available ${availableNodes.length}`);
    }

    return this.selectOptimalNodes(availableNodes, count);
  }


  /**
   * 获取所有已知节点（包括非活跃节点）
   */
  getAllKnownNodes(): BlsNode[] {
    return Array.from(this.knownNodes.values());
  }

  /**
   * 初始化节点发现
   */
  private async initializeNodeDiscovery(): Promise<void> {
    this.logger.log(`Discovering nodes from ${this.signerNodes.length} signer endpoints...`);
    
    // 直接从signer节点的HTTP API获取节点列表
    await this.discoverNodesFromSigners();
  }

  /**
   * 从signer节点发现所有BLS节点
   */
  private async discoverNodesFromSigners(): Promise<void> {
    const discoveryPromises = this.signerNodes.map(async (endpoint) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${endpoint}/gossip/peers`, {
          signal: controller.signal,
          method: 'GET'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const result = await response.json();
          if (result.success && Array.isArray(result.peers)) {
            result.peers.forEach(peer => this.processPeerInfo(peer));
            this.logger.log(`✅ Discovered ${result.peers.length} nodes from ${endpoint}`);
          }
        } else {
          this.logger.warn(`❌ Failed to get peers from ${endpoint}: ${response.statusText}`);
        }
      } catch (error) {
        this.logger.error(`Failed to discover nodes from ${endpoint}:`, error);
      }
    });

    await Promise.allSettled(discoveryPromises);
    this.logger.log(`📊 Total discovered nodes: ${this.knownNodes.size}`);
  }



  /**
   * 处理单个peer信息
   */
  private processPeerInfo(peerInfo: any): void {
    if (!peerInfo.nodeId || peerInfo.nodeId === 'aastar') {
      return; // 忽略自己或无效节点
    }

    const node: BlsNode = {
      nodeId: peerInfo.nodeId || peerInfo.id,
      publicKey: peerInfo.publicKey,
      apiEndpoint: peerInfo.apiEndpoint,
      gossipEndpoint: peerInfo.gossipEndpoint,
      status: peerInfo.status || 'active',
      lastSeen: peerInfo.lastSeen ? new Date(peerInfo.lastSeen) : new Date(),
      region: peerInfo.region || 'unknown',
      capabilities: peerInfo.capabilities || ['bls-signing'],
      version: peerInfo.version || '1.0.0',
      heartbeatCount: peerInfo.heartbeatCount || 0,
    };

    const existingNode = this.knownNodes.get(node.nodeId);
    if (!existingNode) {
      this.knownNodes.set(node.nodeId, node);
      this.logger.log(`🔍 Discovered new BLS node: ${node.nodeId} (${node.apiEndpoint})`);
    } else {
      // 更新现有节点信息
      existingNode.lastSeen = node.lastSeen;
      existingNode.status = node.status;
      existingNode.heartbeatCount = node.heartbeatCount;
      existingNode.publicKey = node.publicKey; // 更新公钥以防有变化
    }
  }


  /**
   * 开始健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
      this.updateNodeStatuses();
    }, this.config.healthCheckInterval);
  }

  /**
   * 开始周期性节点发现
   */
  private startPeriodicDiscovery(): void {
    this.discoveryInterval = setInterval(() => {
      this.discoverNodesFromSigners();
      this.stats.discoveryRounds++;
      this.stats.lastDiscoveryTime = new Date();
    }, this.config.discoveryInterval);
  }

  /**
   * 开始重连循环
   */
  private startReconnectLoop(): void {
    this.reconnectInterval = setInterval(() => {
      this.attemptReconnections();
    }, this.config.reconnectInterval);
  }

  /**
   * 尝试重新发现节点
   */
  private attemptReconnections(): void {
    // 重新从signer节点发现网络
    this.discoverNodesFromSigners();
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    const healthCheckPromises = Array.from(this.knownNodes.values()).map(async (node) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${node.apiEndpoint}/node/info`, {
          signal: controller.signal,
          method: 'GET'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          node.status = 'active';
          node.lastSeen = new Date();
        } else {
          this.markNodeAsSuspected(node);
        }
      } catch (error) {
        this.markNodeAsSuspected(node);
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * 更新节点状态
   */
  private updateNodeStatuses(): void {
    const now = Date.now();
    
    this.knownNodes.forEach(node => {
      const timeSinceLastSeen = now - node.lastSeen.getTime();
      
      if (timeSinceLastSeen > this.config.nodeTimeout * 2) {
        node.status = 'inactive';
      } else if (timeSinceLastSeen > this.config.nodeTimeout) {
        node.status = 'suspected';
      }
    });
  }

  /**
   * 标记节点为可疑
   */
  private markNodeAsSuspected(node: BlsNode): void {
    if (node.status === 'active') {
      node.status = 'suspected';
      this.logger.warn(`Node ${node.nodeId} marked as suspected`);
    }
  }


  /**
   * 检查节点是否健康
   */
  private isNodeHealthy(node: BlsNode): boolean {
    const now = Date.now();
    const timeSinceLastSeen = now - node.lastSeen.getTime();
    
    // 如果超过node timeout，认为节点不健康
    return timeSinceLastSeen < this.config.nodeTimeout;
  }

  /**
   * 选择最优节点
   */
  private selectOptimalNodes(nodes: BlsNode[], count: number): BlsNode[] {
    const shuffled = nodes
      .map(node => ({ node, score: this.calculateNodeScore(node) }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.node);

    return shuffled.slice(0, count);
  }

  /**
   * 计算节点评分
   */
  private calculateNodeScore(node: BlsNode): number {
    let score = 100; // 基础分

    // 根据最后见到时间调整
    const timeSinceLastSeen = Date.now() - node.lastSeen.getTime();
    score -= Math.min(timeSinceLastSeen / 1000, 50); // 最多扣50分

    // 心跳计数加分
    score += Math.min(node.heartbeatCount, 20);

    // 添加随机性，避免总是选择相同的节点
    score += Math.random() * 20;

    return score;
  }

  /**
   * 获取发现统计信息
   */
  getStats() {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    const nodes = Array.from(this.knownNodes.values());
    this.stats.totalNodes = nodes.length;
    this.stats.activeNodes = nodes.filter(n => n.status === 'active').length;
    this.stats.suspectedNodes = nodes.filter(n => n.status === 'suspected').length;
  }


  /**
   * 停止所有定时器
   */
  private stopAllIntervals(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
  }

}
