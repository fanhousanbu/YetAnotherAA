export interface SignatureResult {
  nodeId: string;
  signature: string;
  publicKey: string;
  message: string;
}

export interface AggregateSignatureResult {
  nodeIds: string[];
  signature: string;
  messagePoint: string;
  participantNodes: Array<{
    nodeId: string;
    nodeName: string;
  }>;
}