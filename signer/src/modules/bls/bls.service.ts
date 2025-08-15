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

  async aggregateSignaturesOnly(signatures: any[]): Promise<any> {
    return sigs.aggregateSignatures(signatures);
  }

  async verifySignature(signature: any, messagePoint: any, publicKey: any): Promise<boolean> {
    return await sigs.verify(signature, messagePoint, publicKey);
  }

  async hashMessageToCurve(message: string): Promise<any> {
    const messageBytes = new TextEncoder().encode(message);
    return await bls.G2.hashToCurve(messageBytes, { DST: BLS_DST });
  }

  encodeToEIP2537(point: any): string {
    // Match demo.js implementation exactly: encodeG2Point(bls.G2.Point.fromHex(aggregatedSignature.toBytes()))
    const encoded = encodeG2Point(bls.G2.ProjectivePoint.fromHex(point.toBytes()));
    return "0x" + Buffer.from(encoded).toString('hex');
  }

  encodePublicKeyToEIP2537(publicKey: any): string {
    const encoded = this.encodeG1Point(publicKey);
    return "0x" + Buffer.from(encoded).toString('hex');
  }

  private encodeG1Point(point: any): Uint8Array {
    const result = new Uint8Array(128);
    const affine = point.toAffine();
    
    const xBytes = this.hexToBytes(affine.x.toString(16).padStart(96, '0'));
    const yBytes = this.hexToBytes(affine.y.toString(16).padStart(96, '0'));
    
    result.set(xBytes, 16); // Skip 16 zero bytes at start
    result.set(yBytes, 80); // Skip 16 zero bytes at start
    return result;
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