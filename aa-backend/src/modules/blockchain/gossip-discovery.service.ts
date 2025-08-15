import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { BlsNode, GossipMessage, GossipStats } from '../../interfaces/bls-node.interface';

@Injectable()
export class GossipDiscoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GossipDiscoveryService.name);
  
  private knownNodes = new Map<string, BlsNode>();
  private activeConnections = new Map<string, WebSocket>();
  private bootstrapNodes: string[] = [];
  private heartbeatInterval: NodeJS.Timeout;
  private discoveryInterval: NodeJS.Timeout;
  private reconnectInterval: NodeJS.Timeout;
  private messageHistory = new Map<string, { timestamp: number; propagatedTo: Set<string> }>();
  
  private stats: GossipStats = {
    totalPeers: 0,
    activePeers: 0,
    suspectedPeers: 0,
    messagesSent: 0,
    messagesReceived: 0,
    gossipRounds: 0,
    lastGossipTime: null,
  };

  private readonly config = {
    gossipInterval: 30000,      // 30 seconds
    heartbeatInterval: 15000,   // 15 seconds
    reconnectInterval: 60000,   // 60 seconds
    suspicionTimeout: 45000,    // 45 seconds
    cleanupTimeout: 120000,     // 2 minutes
    maxMessageHistory: 1000,    // Maximum messages to keep in history
    maxTTL: 5,                  // Maximum message propagation hops
  };
  
  constructor(private configService: ConfigService) {
    // 从配置获取bootstrap节点，优先使用gossip配置，fallback到p2p配置
    this.bootstrapNodes = this.configService.get('gossip.bootstrapNodes') || 
                         this.configService.get('p2p.bootstrapNodes') || [
      'ws://localhost:8001',  // 默认gossip节点
      'ws://localhost:8002',
      'ws://localhost:8003',
    ];

    // 从配置更新gossip参数
    this.config.gossipInterval = this.configService.get('gossip.gossipInterval') || this.config.gossipInterval;
    this.config.heartbeatInterval = this.configService.get('gossip.heartbeatInterval') || this.config.heartbeatInterval;
    this.config.reconnectInterval = this.configService.get('gossip.reconnectInterval') || this.config.reconnectInterval;
    this.config.suspicionTimeout = this.configService.get('gossip.suspicionTimeout') || this.config.suspicionTimeout;
    this.config.cleanupTimeout = this.configService.get('gossip.cleanupTimeout') || this.config.cleanupTimeout;
    this.config.maxMessageHistory = this.configService.get('gossip.maxMessageHistory') || this.config.maxMessageHistory;
    this.config.maxTTL = this.configService.get('gossip.maxTTL') || this.config.maxTTL;
  }

  async onModuleInit() {
    this.logger.log('🌐 Starting Gossip Discovery Service...');
    await this.initializeGossipNetwork();
    this.startHeartbeat();
    this.startPeriodicDiscovery();
    this.startReconnectLoop();
  }

  async onModuleDestroy() {
    this.stopAllIntervals();
    this.disconnectAll();
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
   * 获取gossip网络统计信息
   */
  getStats(): GossipStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * 获取所有已知节点（包括非活跃节点）
   */
  getAllKnownNodes(): BlsNode[] {
    return Array.from(this.knownNodes.values());
  }

  /**
   * 初始化Gossip网络连接
   */
  private async initializeGossipNetwork(): Promise<void> {
    this.logger.log(`Connecting to ${this.bootstrapNodes.length} bootstrap nodes...`);
    
    // 连接到bootstrap节点
    await Promise.allSettled(
      this.bootstrapNodes.map(endpoint => this.connectToNode(endpoint))
    );

    // 请求初始peer列表
    await this.requestPeerDiscovery();
  }

  /**
   * 连接到指定节点
   */
  private async connectToNode(endpoint: string): Promise<void> {
    if (this.activeConnections.has(endpoint)) {
      return; // 已经连接
    }

    try {
      const ws = new WebSocket(endpoint);
      
      ws.onopen = () => {
        this.logger.log(`✅ Connected to gossip node: ${endpoint}`);
        this.activeConnections.set(endpoint, ws);
        
        // 发送peer发现请求
        this.sendGossipMessage(ws, {
          type: 'peer_discovery',
          from: 'aa-backend',
          data: { requestPeers: true },
          timestamp: Date.now(),
          ttl: this.config.maxTTL,
          messageId: uuidv4(),
          version: 1
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = typeof event.data === 'string' ? event.data : event.data.toString();
          const message = JSON.parse(data) as GossipMessage;
          this.handleGossipMessage(endpoint, message);
        } catch (error) {
          this.logger.error(`Failed to parse gossip message from ${endpoint}:`, error);
        }
      };

      ws.onclose = () => {
        this.logger.warn(`❌ Disconnected from gossip node: ${endpoint}`);
        this.activeConnections.delete(endpoint);
        this.markNodesAsInactive(endpoint);
      };

      ws.onerror = (error) => {
        this.logger.error(`🚫 Gossip connection error to ${endpoint}:`, error);
      };

    } catch (error) {
      this.logger.error(`Failed to connect to ${endpoint}:`, error);
    }
  }

  /**
   * 处理Gossip消息
   */
  private handleGossipMessage(from: string, message: GossipMessage): void {
    this.stats.messagesReceived++;

    // 检查消息是否已处理过
    if (this.messageHistory.has(message.messageId)) {
      return; // 忽略重复消息
    }

    // 记录消息历史
    this.messageHistory.set(message.messageId, {
      timestamp: Date.now(),
      propagatedTo: new Set()
    });

    // 清理旧消息历史
    this.cleanupMessageHistory();

    switch (message.type) {
      case 'gossip':
        this.handleGossipData(message);
        break;
      
      case 'peer_discovery':
        this.handlePeerDiscovery(message.data);
        break;
      
      case 'heartbeat':
        this.handleHeartbeat(message.from, message.data);
        break;
      
      case 'join':
        this.handleNodeJoin(message.data);
        break;
      
      case 'leave':
        this.handleNodeLeave(message.data);
        break;
      
      default:
        this.logger.warn(`Unknown gossip message type: ${message.type}`);
    }

    // 传播消息（如果TTL > 0）
    if (message.ttl > 0) {
      this.propagateMessage(message, from);
    }
  }

  /**
   * 处理gossip数据
   */
  private handleGossipData(message: GossipMessage): void {
    // 处理从其他节点传播来的数据
    if (message.data && message.data.peers) {
      this.handlePeerDiscovery(message.data.peers);
    }
  }

  /**
   * 处理peer发现响应
   */
  private handlePeerDiscovery(data: any): void {
    if (Array.isArray(data)) {
      // 处理peer列表
      data.forEach(peerInfo => this.processPeerInfo(peerInfo));
    } else if (data.peers && Array.isArray(data.peers)) {
      // 处理包装的peer列表
      data.peers.forEach(peerInfo => this.processPeerInfo(peerInfo));
    }
  }

  /**
   * 处理单个peer信息
   */
  private processPeerInfo(peerInfo: any): void {
    if (!peerInfo.nodeId || peerInfo.nodeId === 'aa-backend') {
      return; // 忽略自己或无效节点
    }

    const node: BlsNode = {
      nodeId: peerInfo.nodeId || peerInfo.id,
      publicKey: peerInfo.publicKey,
      apiEndpoint: peerInfo.apiEndpoint,
      gossipEndpoint: peerInfo.gossipEndpoint,
      status: 'active',
      lastSeen: new Date(),
      region: peerInfo.region || 'unknown',
      capabilities: peerInfo.capabilities || ['bls-signing'],
      version: peerInfo.version || '1.0.0',
      heartbeatCount: 0,
    };

    const existingNode = this.knownNodes.get(node.nodeId);
    if (!existingNode) {
      this.knownNodes.set(node.nodeId, node);
      this.logger.log(`🔍 Discovered new BLS node: ${node.nodeId} (${node.apiEndpoint})`);
      
      // 尝试连接到新发现节点的gossip端点
      if (node.gossipEndpoint && !this.activeConnections.has(node.gossipEndpoint)) {
        setTimeout(() => this.connectToNode(node.gossipEndpoint), 2000);
      }
    } else {
      // 更新现有节点信息
      existingNode.lastSeen = new Date();
      existingNode.status = 'active';
      existingNode.heartbeatCount = 0;
    }
  }

  /**
   * 处理心跳消息
   */
  private handleHeartbeat(nodeId: string, data: any): void {
    const node = this.knownNodes.get(nodeId);
    if (node) {
      node.lastSeen = new Date();
      node.status = 'active';
      node.heartbeatCount++;
    }
  }

  /**
   * 处理节点加入
   */
  private handleNodeJoin(data: any): void {
    this.processPeerInfo(data);
  }

  /**
   * 处理节点离开
   */
  private handleNodeLeave(data: any): void {
    if (data.nodeId) {
      const node = this.knownNodes.get(data.nodeId);
      if (node) {
        node.status = 'inactive';
        this.logger.log(`👋 Node left: ${data.nodeId}`);
      }
    }
  }

  /**
   * 传播消息到其他节点
   */
  private propagateMessage(message: GossipMessage, excludeEndpoint: string): void {
    const propagatedMessage = {
      ...message,
      ttl: message.ttl - 1
    };

    const history = this.messageHistory.get(message.messageId);
    if (!history) return;

    this.activeConnections.forEach((ws, endpoint) => {
      if (endpoint !== excludeEndpoint && 
          !history.propagatedTo.has(endpoint) && 
          ws.readyState === WebSocket.OPEN) {
        
        this.sendGossipMessage(ws, propagatedMessage);
        history.propagatedTo.add(endpoint);
      }
    });
  }

  /**
   * 请求peer发现
   */
  private async requestPeerDiscovery(): Promise<void> {
    const message: GossipMessage = {
      type: 'peer_discovery',
      from: 'aa-backend',
      data: { requestPeers: true },
      timestamp: Date.now(),
      ttl: this.config.maxTTL,
      messageId: uuidv4(),
      version: 1
    };

    this.activeConnections.forEach((ws, endpoint) => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendGossipMessage(ws, message);
      }
    });
  }

  /**
   * 发送Gossip消息
   */
  private sendGossipMessage(ws: WebSocket, message: GossipMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      this.stats.messagesSent++;
    }
  }

  /**
   * 开始心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.performHealthCheck();
      this.updateNodeStatuses();
    }, this.config.heartbeatInterval);
  }

  /**
   * 开始周期性节点发现
   */
  private startPeriodicDiscovery(): void {
    this.discoveryInterval = setInterval(() => {
      this.requestPeerDiscovery();
      this.stats.gossipRounds++;
      this.stats.lastGossipTime = new Date();
    }, this.config.gossipInterval);
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
   * 尝试重连断开的节点
   */
  private attemptReconnections(): void {
    // 重连bootstrap节点
    this.bootstrapNodes.forEach(endpoint => {
      if (!this.activeConnections.has(endpoint)) {
        this.connectToNode(endpoint);
      }
    });

    // 重连已知节点的gossip端点
    this.knownNodes.forEach(node => {
      if (node.status === 'active' && 
          node.gossipEndpoint && 
          !this.activeConnections.has(node.gossipEndpoint)) {
        this.connectToNode(node.gossipEndpoint);
      }
    });
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
      
      if (timeSinceLastSeen > this.config.cleanupTimeout) {
        node.status = 'inactive';
      } else if (timeSinceLastSeen > this.config.suspicionTimeout) {
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
   * 标记连接相关的节点为非活跃
   */
  private markNodesAsInactive(endpoint: string): void {
    this.knownNodes.forEach(node => {
      if (node.gossipEndpoint === endpoint) {
        node.status = 'suspected';
      }
    });
  }

  /**
   * 检查节点是否健康
   */
  private isNodeHealthy(node: BlsNode): boolean {
    const now = Date.now();
    const timeSinceLastSeen = now - node.lastSeen.getTime();
    
    // 如果超过suspicion timeout，认为节点不健康
    return timeSinceLastSeen < this.config.suspicionTimeout;
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
   * 更新统计信息
   */
  private updateStats(): void {
    const nodes = Array.from(this.knownNodes.values());
    this.stats.totalPeers = nodes.length;
    this.stats.activePeers = nodes.filter(n => n.status === 'active').length;
    this.stats.suspectedPeers = nodes.filter(n => n.status === 'suspected').length;
  }

  /**
   * 清理消息历史
   */
  private cleanupMessageHistory(): void {
    if (this.messageHistory.size > this.config.maxMessageHistory) {
      const entries = Array.from(this.messageHistory.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      // 删除最旧的消息
      const toDelete = entries.slice(0, entries.length - this.config.maxMessageHistory);
      toDelete.forEach(([messageId]) => {
        this.messageHistory.delete(messageId);
      });
    }
  }

  /**
   * 停止所有定时器
   */
  private stopAllIntervals(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
  }

  /**
   * 断开所有连接
   */
  private disconnectAll(): void {
    this.activeConnections.forEach((ws, endpoint) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    this.activeConnections.clear();
  }
}
