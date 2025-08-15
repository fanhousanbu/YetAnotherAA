export interface BlsNode {
  nodeId: string;           // bytes32 from contract
  publicKey: string;        // BLS public key from contract  
  apiEndpoint: string;      // API endpoint for REST calls
  gossipEndpoint: string;   // Gossip protocol endpoint
  status: 'active' | 'inactive' | 'suspected';
  lastSeen: Date;
  region?: string;
  capabilities?: string[];
  version?: string;
  heartbeatCount: number;   // For failure detection
}

export interface ContractNodeInfo {
  nodeId: string;
  publicKey: string;
  isRegistered: boolean;
}

export interface ExtendedNodeInfo extends ContractNodeInfo {
  apiEndpoint: string;
  gossipEndpoint: string;
  status: 'active' | 'inactive' | 'suspected';
  lastSeen: Date;
}

export interface GossipMessage {
  type: 'gossip' | 'sync' | 'heartbeat' | 'join' | 'leave' | 'peer_discovery';
  from: string;
  to?: string; // Optional: for directed messages
  data: any;
  timestamp: number;
  ttl: number; // Time to live for message propagation
  messageId: string; // Unique message identifier
  version: number; // Version for conflict resolution
}

export interface GossipStats {
  totalPeers: number;
  activePeers: number;
  suspectedPeers: number;
  messagesSent: number;
  messagesReceived: number;
  gossipRounds: number;
  lastGossipTime: Date | null;
}