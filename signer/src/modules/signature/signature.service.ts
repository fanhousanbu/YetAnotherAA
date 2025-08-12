import { Injectable, BadRequestException } from '@nestjs/common';
import { BlsService } from '../bls/bls.service.js';
import { NodeService } from '../node/node.service.js';
import { SignatureResult, AggregateSignatureResult } from '../../interfaces/signature.interface.js';
import { sigs } from '../../utils/bls.util.js';

@Injectable()
export class SignatureService {
  constructor(
    private readonly blsService: BlsService,
    private readonly nodeService: NodeService
  ) {}

  async signMessage(message: string, nodeId?: string): Promise<SignatureResult> {
    const node = this.nodeService.getNodeForSigning();
    return await this.blsService.signMessage(message, node);
  }

  async aggregateSignatures(message: string, nodeIds?: string[]): Promise<AggregateSignatureResult> {
    const node = this.nodeService.getNodeForSigning();
    const messagePoint = await this.blsService.hashMessageToCurve(message);
    
    const privateKeyBytes = this.hexToBytes(node.privateKey.substring(2));
    const publicKey = sigs.getPublicKey(privateKeyBytes);
    const signature = await sigs.sign(messagePoint as any, privateKeyBytes);
    
    const signatures = [signature];
    const publicKeys = [publicKey];
    const participantNodes = [{
      nodeId: node.contractNodeId,
      nodeName: node.nodeName
    }];

    const { aggregatedSignature, aggregatedPubKey } = await this.blsService.aggregateSignatures(signatures, publicKeys);
    
    const isValid = await this.blsService.verifySignature(aggregatedSignature, messagePoint, aggregatedPubKey);
    if (!isValid) {
      throw new Error('Signature verification failed');
    }

    return {
      nodeIds: [node.contractNodeId],
      signature: this.blsService.encodeToEIP2537(aggregatedSignature),
      messagePoint: this.blsService.encodeToEIP2537(messagePoint),
      participantNodes
    };
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
}