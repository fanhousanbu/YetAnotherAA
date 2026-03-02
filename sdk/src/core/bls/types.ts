export interface BLSNode {
  index?: number;
  nodeId: string;
  nodeName: string;
  apiEndpoint: string;
  status: "active" | "inactive";
  publicKey?: string;
  lastSeen?: Date;
}

export interface BLSSignatureData {
  nodeIds: string[];
  signatures?: string[]; // Individual node signatures (before aggregation)
  publicKeys?: string[]; // Individual node public keys
  signature: string; // Aggregated BLS signature
  messagePoint: string;
  aaAddress: string;
  aaSignature: string; // ECDSA signature of userOpHash
  messagePointSignature: string; // ECDSA signature of messagePoint
  aggregatedSignature?: string; // Alias for aggregated signature
}

export interface BLSConfig {
  seedNodes: string[];
  discoveryTimeout?: number;
}
