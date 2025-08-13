import { Injectable, BadRequestException } from '@nestjs/common';
import { BlsService } from '../bls/bls.service.js';
import { NodeService } from '../node/node.service.js';
import { SignatureResult, AggregateSignatureResult } from '../../interfaces/signature.interface.js';
import { sigs, bls } from '../../utils/bls.util.js';

@Injectable()
export class SignatureService {
  constructor(
    private readonly blsService: BlsService,
    private readonly nodeService: NodeService
  ) {}

  async signMessage(message: string): Promise<SignatureResult> {
    const node = this.nodeService.getNodeForSigning();
    return await this.blsService.signMessage(message, node);
  }

  async aggregateExternalSignatures(signatureStrings: string[]): Promise<AggregateSignatureResult> {
    if (signatureStrings.length < 1) {
      throw new BadRequestException('At least 1 signature is required for aggregation');
    }

    const signatures = [];

    for (const sigHex of signatureStrings) {
      // Convert hex strings to BLS signature format
      const signature = this.hexToBlsSignature(sigHex);
      signatures.push(signature);
    }

    // Aggregate signatures only
    const aggregatedSignature = await this.blsService.aggregateSignaturesOnly(signatures);

    return {
      signature: this.blsService.encodeToEIP2537(aggregatedSignature)
    };
  }

  private hexToBlsSignature(hex: string): any {
    const cleanHex = hex.startsWith('0x') ? hex.substring(2) : hex;
    return sigs.Signature.fromHex(cleanHex);
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
}