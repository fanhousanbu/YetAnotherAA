import { Injectable } from '@nestjs/common';
import { bls, sigs, BLS_DST, encodeG2Point } from '../../utils/bls.util.js';
import { SignatureResult } from '../../interfaces/signature.interface.js';
import { NodeKeyPair } from '../../interfaces/node.interface.js';

@Injectable()
export class BlsService {
  async signMessage(message: string, node: NodeKeyPair): Promise<SignatureResult> {
    const messageBytes = new TextEncoder().encode(message);
    const messagePoint = await bls.G2.hashToCurve(messageBytes, { DST: BLS_DST });
    
    const privateKeyBytes = this.hexToBytes(node.privateKey.substring(2));
    const publicKey = sigs.getPublicKey(privateKeyBytes);
    const signature = await sigs.sign(messagePoint as any, privateKeyBytes);
    
    return {
      nodeId: node.contractNodeId,
      signature: signature.toHex(),
      publicKey: publicKey.toHex(),
      message: message
    };
  }

  async aggregateSignatures(signatures: any[], publicKeys: any[]): Promise<any> {
    const aggregatedSignature = sigs.aggregateSignatures(signatures);
    const aggregatedPubKey = sigs.aggregatePublicKeys(publicKeys);
    return { aggregatedSignature, aggregatedPubKey };
  }

  async verifySignature(signature: any, messagePoint: any, publicKey: any): Promise<boolean> {
    return await sigs.verify(signature, messagePoint, publicKey);
  }

  async hashMessageToCurve(message: string): Promise<any> {
    const messageBytes = new TextEncoder().encode(message);
    return await bls.G2.hashToCurve(messageBytes, { DST: BLS_DST });
  }

  encodeToEIP2537(point: any): string {
    const encoded = encodeG2Point(bls.G2.Point.fromHex(point.toBytes()));
    return "0x" + Buffer.from(encoded).toString('hex');
  }

  async getPublicKeyFromPrivateKey(privateKey: string): Promise<string> {
    const privateKeyBytes = this.hexToBytes(privateKey.substring(2));
    const publicKey = sigs.getPublicKey(privateKeyBytes);
    return '0x' + publicKey.toHex();
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
}