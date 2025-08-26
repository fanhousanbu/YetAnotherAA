export interface NodeKeyPair {
  originalNodeId: string;
  contractNodeId: string;
  nodeName: string;
  privateKey: string;
  publicKey: string;
  registrationStatus: string;
  description: string;
}

export interface NodeState {
  nodeId: string;
  nodeName: string;
  privateKey: string;
  publicKey: string;
  contractNodeId: string;
  registrationStatus: "pending" | "registered" | "failed";
  registeredAt?: string;
  contractAddress?: string;
  createdAt: string;
  description: string;
}

export interface SignerConfig {
  description: string;
  contractAddress: string;
  registeredAt: string;
  totalNodes: number;
  owner: string;
  keyPairs: NodeKeyPair[];
  contractInfo: {
    name: string;
    address: string;
    network: string;
    owner: string;
    registeredNodes: number;
  };
}
