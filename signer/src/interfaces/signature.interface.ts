export interface SignatureResult {
  nodeId: string;
  signature: string;
  publicKey: string;
  message: string;
}

export interface AggregateSignatureResult {
  signature: string;
}