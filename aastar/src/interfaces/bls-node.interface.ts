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

