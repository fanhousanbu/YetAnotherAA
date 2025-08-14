import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as WebSocket from 'ws';
import { BlsNode } from '../../interfaces/bls-node.interface';

interface P2PMessage {
  type: 'discover' | 'announce' | 'heartbeat' | 'peer_list';
  from: string;
  data: any;
  timestamp: number;
}

@Injectable()
export class P2PDiscoveryService implements OnModuleInit, OnModuleDestroy {
  private knownNodes = new Map<string, BlsNode>();
  private activeConnections = new Map<string, WebSocket>();
  private bootstrapNodes: string[] = [];
  private heartbeatInterval: NodeJS.Timeout;
  private discoveryInterval: NodeJS.Timeout;
  
  constructor(private configService: ConfigService) {
    // 从配置获取bootstrap节点
    this.bootstrapNodes = this.configService.get('p2p.bootstrapNodes') || [
      'ws://localhost:8001',  // 默认bootstrap节点
      'ws://localhost:8002',
    ];
  }

  async onModuleInit() {
    console.log('🌐 Starting P2P Discovery Service...');
    await this.initializeP2PNetwork();
    this.startHeartbeat();
    this.startPeriodicDiscovery();
  }

  async onModuleDestroy() {
    this.stopHeartbeat();
    this.stopPeriodicDiscovery();
    this.disconnectAll();
  }

  /**
   * 获取当前可用的BLS节点列表
   */
  async getAvailableNodes(): Promise<BlsNode[]> {
    const activeNodes = Array.from(this.knownNodes.values())
      .filter(node => node.status === 'active')
      .filter(node => this.isNodeHealthy(node));

    console.log(`📊 Found ${activeNodes.length} active BLS nodes`);
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

    // 智能选择算法：负载均衡 + 随机化
    return this.selectOptimalNodes(availableNodes, count);
  }

  /**
   * 初始化P2P网络连接
   */
  private async initializeP2PNetwork(): Promise<void> {
    // 连接到bootstrap节点
    await Promise.allSettled(
      this.bootstrapNodes.map(endpoint => this.connectToNode(endpoint))
    );

    // 请求初始peer列表
    await this.requestInitialPeers();
  }

  /**
   * 连接到指定节点
   */
  private async connectToNode(endpoint: string): Promise<void> {
    try {
      const ws = new WebSocket(endpoint);
      
      ws.onopen = () => {
        console.log(`✅ Connected to P2P node: ${endpoint}`);
        this.activeConnections.set(endpoint, ws);
        
        // 发送节点发现请求
        this.sendMessage(ws, {
          type: 'discover',
          from: 'aa-backend',
          data: { requestPeers: true },
          timestamp: Date.now()
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = typeof event.data === 'string' ? event.data : event.data.toString();
          this.handleP2PMessage(endpoint, JSON.parse(data));
        } catch (error) {
          console.error(`Failed to parse P2P message from ${endpoint}:`, error);
        }
      };

      ws.onclose = () => {
        console.log(`❌ Disconnected from P2P node: ${endpoint}`);
        this.activeConnections.delete(endpoint);
      };

      ws.onerror = (error) => {
        console.error(`🚫 P2P connection error to ${endpoint}:`, error);
      };

    } catch (error) {
      console.error(`Failed to connect to ${endpoint}:`, error);
    }
  }

  /**
   * 处理P2P消息
   */
  private handleP2PMessage(from: string, message: P2PMessage): void {
    switch (message.type) {
      case 'announce':
        this.handleNodeAnnouncement(message.data);
        break;
      
      case 'peer_list':
        this.handlePeerList(message.data);
        break;
      
      case 'heartbeat':
        this.handleHeartbeat(message.from, message.data);
        break;
      
      default:
        console.log(`Unknown P2P message type: ${message.type}`);
    }
  }

  /**
   * 处理节点公告
   */
  private handleNodeAnnouncement(nodeInfo: any): void {
    const node: BlsNode = {
      nodeId: nodeInfo.id,
      publicKey: nodeInfo.publicKey,
      endpoint: nodeInfo.apiEndpoint,
      status: 'active',
      lastHeartbeat: new Date(),
      metadata: {
        region: nodeInfo.region,
        capabilities: nodeInfo.capabilities || [],
        version: nodeInfo.version
      }
    };

    this.knownNodes.set(node.nodeId, node);
    console.log(`📢 New BLS node announced: ${node.nodeId}`);
  }

  /**
   * 处理peer列表响应
   */
  private handlePeerList(peers: any[]): void {
    peers.forEach(peer => {
      if (!this.knownNodes.has(peer.id)) {
        this.handleNodeAnnouncement(peer);
        
        // 尝试连接到新发现的节点
        if (peer.p2pEndpoint) {
          this.connectToNode(peer.p2pEndpoint);
        }
      }
    });
  }

  /**
   * 处理心跳消息
   */
  private handleHeartbeat(nodeId: string, data: any): void {
    const node = this.knownNodes.get(nodeId);
    if (node) {
      node.lastHeartbeat = new Date();
      node.status = 'active';
    }
  }

  /**
   * 请求初始peer列表
   */
  private async requestInitialPeers(): Promise<void> {
    const message: P2PMessage = {
      type: 'discover',
      from: 'aa-backend',
      data: { requestPeers: true },
      timestamp: Date.now()
    };

    this.activeConnections.forEach((ws, endpoint) => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
      }
    });
  }

  /**
   * 发送P2P消息
   */
  private sendMessage(ws: WebSocket, message: P2PMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * 开始心跳检测
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // 每30秒检查一次
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  /**
   * 开始周期性节点发现
   */
  private startPeriodicDiscovery(): void {
    this.discoveryInterval = setInterval(() => {
      this.requestInitialPeers();
    }, 60000); // 每分钟发现一次新节点
  }

  /**
   * 停止周期性发现
   */
  private stopPeriodicDiscovery(): void {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }
  }

  /**
   * 执行健康检查
   */
  private async performHealthCheck(): Promise<void> {
    const healthCheckPromises = Array.from(this.knownNodes.values()).map(async (node) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${node.endpoint}/health`, {
          signal: controller.signal,
          method: 'GET'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          node.status = 'active';
          node.lastHeartbeat = new Date();
        } else {
          node.status = 'inactive';
        }
      } catch (error) {
        node.status = 'inactive';
        console.warn(`Node ${node.nodeId} health check failed:`, error.message);
      }
    });

    await Promise.allSettled(healthCheckPromises);
  }

  /**
   * 检查节点是否健康
   */
  private isNodeHealthy(node: BlsNode): boolean {
    if (!node.lastHeartbeat) return false;
    
    const now = new Date();
    const timeDiff = now.getTime() - node.lastHeartbeat.getTime();
    
    // 如果超过2分钟没有心跳，认为节点不健康
    return timeDiff < 2 * 60 * 1000;
  }

  /**
   * 选择最优节点
   */
  private selectOptimalNodes(nodes: BlsNode[], count: number): BlsNode[] {
    // 添加一些随机性和负载均衡逻辑
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

    // 根据最后心跳时间调整
    if (node.lastHeartbeat) {
      const timeSinceHeartbeat = Date.now() - node.lastHeartbeat.getTime();
      score -= Math.min(timeSinceHeartbeat / 1000, 50); // 最多扣50分
    }

    // 添加随机性，避免总是选择相同的节点
    score += Math.random() * 20;

    return score;
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