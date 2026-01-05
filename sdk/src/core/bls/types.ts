export interface BLSNode {
  index?: number;
  nodeId: string;
  nodeName: string;
  apiEndpoint: string;
  status: 'active' | 'inactive';
  publicKey?: string;
  lastSeen?: Date;
}

export interface BLSSignatureData {
  nodeIds: string[];
  signature: string; // Aggregated BLS signature
  messagePoint: string;
  aaAddress: string;
  aaSignature: string; // ECDSA signature of userOpHash
  messagePointSignature: string; // ECDSA signature of messagePoint
}

export interface BLSConfig {
  seedNodes: string[];
  discoveryTimeout?: number;
}
