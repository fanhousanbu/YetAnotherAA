import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket, { WebSocketServer } from 'ws';
import { NodeService } from '../node/node.service.js';

interface P2PMessage {
  type: 'discover' | 'announce' | 'heartbeat' | 'peer_list' | 'ping' | 'pong';
  from: string;
  data: any;
  timestamp: number;
}

export interface PeerInfo {
  nodeId: string;
  publicKey: string;
  apiEndpoint: string;
  p2pEndpoint: string;
  status: 'active' | 'inactive';
  lastSeen: Date;
  region?: string;
  capabilities?: string[];
  version?: string;
}

@Injectable()
export class P2PService implements OnModuleInit, OnModuleDestroy {
  private server: WebSocketServer;
  private peers = new Map<string, PeerInfo>();
  private connections = new Map<string, WebSocket>();
  private bootstrapPeers: string[] = [];
  private heartbeatInterval: NodeJS.Timeout;
  private discoveryInterval: NodeJS.Timeout;
  
  private readonly port: number;
  private readonly apiPort: number;
  
  constructor(
    private configService: ConfigService,
    private nodeService: NodeService,
  ) {
    this.port = parseInt(this.configService.get('P2P_PORT') || '8001', 10);
    this.apiPort = parseInt(this.configService.get('PORT') || '3001', 10);
    this.bootstrapPeers = this.configService.get('P2P_BOOTSTRAP_PEERS')
      ? this.configService.get('P2P_BOOTSTRAP_PEERS').split(',').map((p: string) => p.trim())
      : [];
  }

  async onModuleInit() {
    console.log(`🌐 Starting BLS Signer P2P Service on port ${this.port}...`);
    await this.startP2PServer();
    await this.connectToBootstrapPeers();
    this.startHeartbeat();
    this.startPeriodicDiscovery();
    this.announceToNetwork();
  }

  async onModuleDestroy() {
    this.stopHeartbeat();
    this.stopPeriodicDiscovery();
    this.disconnectFromPeers();
    this.server?.close();
  }

  /**
   * 启动P2P WebSocket服务器
   */
  private async startP2PServer(): Promise<void> {
    this.server = new WebSocketServer({ 
      port: this.port,
      host: '0.0.0.0'
    });

    this.server.on('connection', (ws: WebSocket, request) => {
      const clientIP = request.socket.remoteAddress || 'unknown';
      console.log(`📡 New P2P connection from ${clientIP}`);

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const message = JSON.parse(data.toString()) as P2PMessage;
          this.handleP2PMessage(ws, message, clientIP);
        } catch (error) {
          console.error('Failed to parse P2P message:', error);
        }
      });

      ws.on('close', () => {
        console.log(`❌ P2P connection closed from ${clientIP}`);
        // 清理连接记录
        this.connections.forEach((conn, endpoint) => {
          if (conn === ws) {
            this.connections.delete(endpoint);
          }
        });
      });

      ws.on('error', (error: Error) => {
        console.error(`P2P connection error from ${clientIP}:`, error);
      });

      // 发送欢迎消息
      this.sendMessage(ws, {
        type: 'announce',
        from: this.getNodeId(),
        data: this.getNodeInfo(),
        timestamp: Date.now()
      });
    });

    console.log(`✅ P2P Server listening on ws://localhost:${this.port}`);
  }

  /**
   * 连接到bootstrap节点
   */
  private async connectToBootstrapPeers(): Promise<void> {
    if (this.bootstrapPeers.length === 0) {
      console.log('⚠️  No bootstrap peers configured, running in standalone mode');
      return;
    }

    // 过滤掉自己的端点，避免连接自己
    const myP2PEndpoint = `ws://localhost:${this.port}`;
    const validBootstrapPeers = this.bootstrapPeers.filter(peer => peer !== myP2PEndpoint);
    
    if (validBootstrapPeers.length === 0) {
      console.log('⚠️  All bootstrap peers are self-references, running in standalone mode');
      return;
    }

    console.log(`🔗 Connecting to ${validBootstrapPeers.length} bootstrap peers...`);
    await Promise.allSettled(
      validBootstrapPeers.map(peer => this.connectToPeer(peer))
    );
  }

  /**
   * 连接到指定peer
   */
  private async connectToPeer(endpoint: string): Promise<void> {
    try {
      console.log(`🔗 Connecting to peer: ${endpoint}`);
      const ws = new WebSocket(endpoint);
      
      ws.on('open', () => {
        console.log(`✅ Connected to peer: ${endpoint}`);
        this.connections.set(endpoint, ws);
        
        // 请求peer列表
        this.sendMessage(ws, {
          type: 'discover',
          from: this.getNodeId(),
          data: { requestPeers: true },
          timestamp: Date.now()
        });
      });

      ws.on('message', (data: WebSocket.RawData) => {
        try {
          const message = JSON.parse(data.toString()) as P2PMessage;
          this.handleP2PMessage(ws, message, endpoint);
        } catch (error) {
          console.error(`Failed to parse message from ${endpoint}:`, error);
        }
      });

      ws.on('close', () => {
        console.log(`❌ Disconnected from peer: ${endpoint}`);
        this.connections.delete(endpoint);
      });

      ws.on('error', (error: Error) => {
        console.error(`Connection error to ${endpoint}:`, error);
      });

    } catch (error) {
      console.error(`Failed to connect to ${endpoint}:`, error);
    }
  }

  /**
   * 处理P2P消息
   */
  private handleP2PMessage(ws: WebSocket, message: P2PMessage, from: string): void {
    switch (message.type) {
      case 'discover':
        this.handleDiscoverRequest(ws, message);
        break;
      
      case 'announce':
        this.handleNodeAnnouncement(message.data);
        break;
      
      case 'peer_list':
        this.handlePeerList(message.data);
        break;
      
      case 'heartbeat':
        this.handleHeartbeat(message.from, message.data);
        break;
      
      case 'ping':
        this.handlePing(ws, message);
        break;
      
      case 'pong':
        this.handlePong(message);
        break;
      
      default:
        console.log(`Unknown message type: ${message.type} from ${from}`);
    }
  }

  /**
   * 处理节点发现请求
   */
  private handleDiscoverRequest(ws: WebSocket, message: P2PMessage): void {
    if (message.data.requestPeers) {
      // 返回已知的peer列表
      const peerList = Array.from(this.peers.values()).map(peer => ({
        id: peer.nodeId,
        publicKey: peer.publicKey,
        apiEndpoint: peer.apiEndpoint,
        p2pEndpoint: peer.p2pEndpoint,
        region: peer.region,
        capabilities: peer.capabilities,
        version: peer.version
      }));

      this.sendMessage(ws, {
        type: 'peer_list',
        from: this.getNodeId(),
        data: peerList,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 处理节点公告
   */
  private handleNodeAnnouncement(nodeInfo: any): void {
    const peer: PeerInfo = {
      nodeId: nodeInfo.id,
      publicKey: nodeInfo.publicKey,
      apiEndpoint: nodeInfo.apiEndpoint,
      p2pEndpoint: nodeInfo.p2pEndpoint,
      status: 'active',
      lastSeen: new Date(),
      region: nodeInfo.region,
      capabilities: nodeInfo.capabilities || ['bls-signing'],
      version: nodeInfo.version
    };

    const isNewPeer = !this.peers.has(peer.nodeId);
    this.peers.set(peer.nodeId, peer);
    console.log(`📢 Node announced: ${peer.nodeId} (${peer.apiEndpoint})`);

    // 如果是新节点，广播更新的peer列表给所有连接
    if (isNewPeer) {
      setTimeout(() => this.broadcastUpdatedPeerList(), 1000); // 延迟1秒广播
    }
  }

  /**
   * 处理peer列表
   */
  private handlePeerList(peers: any[]): void {
    console.log(`📋 Received ${peers.length} peers from network`);
    
    peers.forEach(peer => {
      if (!this.peers.has(peer.id) && peer.id !== this.getNodeId()) {
        this.handleNodeAnnouncement(peer);
        
        // 尝试连接到新的peer，但避免连接自己
        const myP2PEndpoint = `ws://localhost:${this.port}`;
        if (peer.p2pEndpoint && 
            !this.connections.has(peer.p2pEndpoint) && 
            peer.p2pEndpoint !== myP2PEndpoint) {
          console.log(`🔗 Connecting to discovered peer: ${peer.p2pEndpoint}`);
          this.connectToPeer(peer.p2pEndpoint);
        }
      }
    });

    // 新发现节点后，重新向所有连接广播我们的完整peer列表
    this.broadcastUpdatedPeerList();
  }

  /**
   * 处理心跳
   */
  private handleHeartbeat(nodeId: string, data: any): void {
    const peer = this.peers.get(nodeId);
    if (peer) {
      peer.lastSeen = new Date();
      peer.status = 'active';
    }
  }

  /**
   * 处理ping
   */
  private handlePing(ws: WebSocket, message: P2PMessage): void {
    this.sendMessage(ws, {
      type: 'pong',
      from: this.getNodeId(),
      data: { pingId: message.data.pingId },
      timestamp: Date.now()
    });
  }

  /**
   * 处理pong
   */
  private handlePong(message: P2PMessage): void {
    // 可以用于测量延迟
    console.log(`🏓 Pong received from ${message.from}`);
  }

  /**
   * 向网络公告自己
   */
  private announceToNetwork(): void {
    const nodeInfo = this.getNodeInfo();
    const announcement: P2PMessage = {
      type: 'announce',
      from: this.getNodeId(),
      data: nodeInfo,
      timestamp: Date.now()
    };

    this.broadcastMessage(announcement);
  }

  /**
   * 广播消息到所有连接的peers
   */
  private broadcastMessage(message: P2PMessage): void {
    this.connections.forEach((ws, endpoint) => {
      if (ws.readyState === WebSocket.OPEN) {
        this.sendMessage(ws, message);
      }
    });
  }

  /**
   * 广播更新的peer列表到所有连接
   */
  private broadcastUpdatedPeerList(): void {
    const peerList = Array.from(this.peers.values()).map(peer => ({
      id: peer.nodeId,
      publicKey: peer.publicKey,
      apiEndpoint: peer.apiEndpoint,
      p2pEndpoint: peer.p2pEndpoint,
      region: peer.region,
      capabilities: peer.capabilities,
      version: peer.version
    }));

    const message: P2PMessage = {
      type: 'peer_list',
      from: this.getNodeId(),
      data: peerList,
      timestamp: Date.now()
    };

    this.broadcastMessage(message);
    console.log(`📢 Broadcasting updated peer list (${peerList.length} peers)`);
  }

  /**
   * 发送消息
   */
  private sendMessage(ws: WebSocket, message: P2PMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * 开始心跳
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const heartbeat: P2PMessage = {
        type: 'heartbeat',
        from: this.getNodeId(),
        data: { 
          timestamp: Date.now(),
          status: 'active'
        },
        timestamp: Date.now()
      };
      
      this.broadcastMessage(heartbeat);
    }, 30000); // 每30秒发送心跳
  }

  /**
   * 停止心跳
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  /**
   * 开始周期性发现
   */
  private startPeriodicDiscovery(): void {
    this.discoveryInterval = setInterval(() => {
      // 定期重新公告自己
      this.announceToNetwork();
    }, 60000); // 每分钟公告一次
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
   * 断开所有peer连接
   */
  private disconnectFromPeers(): void {
    this.connections.forEach((ws, endpoint) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
    this.connections.clear();
  }

  /**
   * 获取当前节点ID
   */
  private getNodeId(): string {
    const nodeState = this.nodeService.getNodeState();
    return nodeState?.nodeId || 'unknown-node';
  }

  /**
   * 获取节点信息
   */
  private getNodeInfo(): any {
    const nodeState = this.nodeService.getNodeState();
    
    return {
      id: nodeState?.nodeId || 'unknown-node',
      publicKey: nodeState?.publicKey,
      apiEndpoint: `http://localhost:${this.apiPort}`,
      p2pEndpoint: `ws://localhost:${this.port}`,
      region: 'local',
      capabilities: ['bls-signing', 'message-aggregation'],
      version: '1.0.0',
      status: 'active'
    };
  }

  /**
   * 获取已知的peers
   */
  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values()).filter(peer => peer.status === 'active');
  }

  /**
   * 获取连接统计
   */
  getStats(): any {
    return {
      activePeers: this.peers.size,
      activeConnections: this.connections.size,
      port: this.port,
      apiPort: this.apiPort
    };
  }
}