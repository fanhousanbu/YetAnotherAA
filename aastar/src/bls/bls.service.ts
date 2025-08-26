import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { bls12_381 as bls } from '@noble/curves/bls12-381';
import { DatabaseService } from '../database/database.service';
import { AccountService } from '../account/account.service';
import { BlsSignatureData } from '../common/interfaces/erc4337.interface';

@Injectable()
export class BlsService {
  private blsConfig: any;

  constructor(
    private databaseService: DatabaseService,
    private accountService: AccountService,
  ) {
    this.blsConfig = this.databaseService.getBlsConfig();
  }

  async generateBLSSignature(
    userId: string,
    userOpHash: string,
    nodeIndices: number[] = [1, 2, 3],
  ): Promise<BlsSignatureData> {
    // Validate node indices
    const indices = nodeIndices.map(n => n - 1);
    for (const index of indices) {
      if (index < 0 || index >= this.blsConfig.keyPairs.length) {
        throw new Error(
          `Node index ${index + 1} is out of range (1-${this.blsConfig.keyPairs.length})`,
        );
      }
    }

    // Get selected nodes
    const selectedNodes = indices.map(i => this.blsConfig.keyPairs[i]);

    // BLS signature parameters
    const messageBytes = ethers.getBytes(userOpHash);
    const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';

    // Generate G2 point message
    const messagePoint = await bls.G2.hashToCurve(messageBytes, { DST });

    // Generate signature for each node
    const signatures = [];
    const nodeIds = [];

    for (const node of selectedNodes) {
      const privateKeyBytes = this.hexToBytes(node.privateKey.substring(2));
      
      // Convert private key to bigint
      let privateKeyBn = 0n;
      for (const byte of privateKeyBytes) {
        privateKeyBn = (privateKeyBn << 8n) + BigInt(byte);
      }
      
      // Multiply message point by private key to get signature
      const signature = messagePoint.multiply(privateKeyBn);

      signatures.push(signature);
      nodeIds.push(node.contractNodeId);
    }

    // Aggregate signatures (simple addition of points)
    let aggregatedSignature = signatures[0];
    for (let i = 1; i < signatures.length; i++) {
      aggregatedSignature = aggregatedSignature.add(signatures[i]);
    }

    // Convert to contract format
    const aggregatedSignatureEIP = this.encodeG2Point(aggregatedSignature);
    const messageG2EIP = this.encodeG2Point(messagePoint);

    // Generate AA signature using user's account owner private key
    const account = this.accountService.getAccountByUserId(userId);
    if (!account) {
      throw new Error('User account not found');
    }

    const wallet = new ethers.Wallet(account.ownerPrivateKey);
    const aaSignature = await wallet.signMessage(ethers.getBytes(userOpHash));

    return {
      nodeIds: nodeIds,
      signature: '0x' + Buffer.from(aggregatedSignatureEIP).toString('hex'),
      messagePoint: '0x' + Buffer.from(messageG2EIP).toString('hex'),
      aaAddress: account.ownerAddress,
      aaSignature: aaSignature,
    };
  }

  async packSignature(blsData: BlsSignatureData): Promise<string> {
    // Pack signature for UserOp
    const nodeIdsLength = ethers.solidityPacked(['uint256'], [blsData.nodeIds.length]);
    const nodeIdsBytes = ethers.solidityPacked(
      Array(blsData.nodeIds.length).fill('bytes32'),
      blsData.nodeIds,
    );

    return ethers.solidityPacked(
      ['bytes', 'bytes', 'bytes', 'bytes', 'bytes'],
      [nodeIdsLength, nodeIdsBytes, blsData.signature, blsData.messagePoint, blsData.aaSignature],
    );
  }

  getAvailableNodes() {
    return this.blsConfig.keyPairs.map((node, index) => ({
      index: index + 1,
      nodeId: node.contractNodeId,
      nodeName: node.nodeName,
      status: node.registrationStatus,
    }));
  }

  getNodesByIndices(indices: number[]) {
    return indices.map(i => {
      const node = this.blsConfig.keyPairs[i - 1];
      if (!node) throw new Error(`Node ${i} not found`);
      return {
        index: i,
        nodeId: node.contractNodeId,
        nodeName: node.nodeName,
      };
    });
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  private encodeG2Point(point: any): Uint8Array {
    const result = new Uint8Array(256);
    const affine = point.toAffine();

    const x0Bytes = this.hexToBytes(affine.x.c0.toString(16).padStart(96, '0'));
    const x1Bytes = this.hexToBytes(affine.x.c1.toString(16).padStart(96, '0'));
    const y0Bytes = this.hexToBytes(affine.y.c0.toString(16).padStart(96, '0'));
    const y1Bytes = this.hexToBytes(affine.y.c1.toString(16).padStart(96, '0'));

    result.set(x0Bytes, 16);
    result.set(x1Bytes, 80);
    result.set(y0Bytes, 144);
    result.set(y1Bytes, 208);
    return result;
  }
}