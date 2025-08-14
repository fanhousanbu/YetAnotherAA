export interface BlsNode {
  nodeId: string;           // bytes32 from contract
  publicKey: string;        // BLS public key from contract  
  endpoint: string;         // API endpoint (from extended storage)
  status: 'active' | 'inactive';
  lastHeartbeat?: Date;
  metadata?: {
    region?: string;
    capabilities?: string[];
    version?: string;
  };
}

export interface ContractNodeInfo {
  nodeId: string;
  publicKey: string;
  isRegistered: boolean;
}

export interface ExtendedNodeInfo extends ContractNodeInfo {
  endpoint: string;
  status: 'active' | 'inactive';
  lastHeartbeat: Date;
}