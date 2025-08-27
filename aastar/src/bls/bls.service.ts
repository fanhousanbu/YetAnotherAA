import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
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
    private configService: ConfigService,
  ) {
    this.blsConfig = this.databaseService.getBlsConfig();
  }

  async getActiveSignerNodes(): Promise<any[]> {
    const blsSignerUrl = this.configService.get<string>('BLS_SIGNER_URL') || 'http://localhost:3001';
    
    try {
      const response = await axios.get(`${blsSignerUrl}/gossip/peers`);
      const peers = response.data.peers || [];
      
      // Filter active peers
      const activeNodes = peers.filter((peer: any) => 
        peer.status === 'active' && 
        peer.apiEndpoint && 
        peer.publicKey
      );
      
      if (activeNodes.length === 0) {
        throw new Error('No active BLS signer nodes found');
      }
      
      console.log(`Found ${activeNodes.length} active BLS nodes:`, 
        activeNodes.map((n: any) => n.apiEndpoint)
      );
      
      return activeNodes;
    } catch (error: any) {
      console.error('Failed to get active signer nodes:', error.message);
      throw new Error(`Unable to connect to BLS signer network: ${error.message}`);
    }
  }

  async generateBLSSignatureFromSigners(
    userId: string,
    userOpHash: string,
  ): Promise<BlsSignatureData> {
    // Get active nodes from gossip network
    const activeNodes = await this.getActiveSignerNodes();
    
    if (activeNodes.length === 0) {
      throw new Error('No active BLS signer nodes available');
    }
    
    // Use first 3 active nodes (or all if less than 3)
    const selectedNodes = activeNodes.slice(0, Math.min(3, activeNodes.length));
    
    try {
      // Request signatures from each selected node
      const signatures = [];
      const publicKeys = [];
      const nodeIds = [];
      
      for (const node of selectedNodes) {
        try {
          const response = await axios.post(`${node.apiEndpoint}/signature/sign`, {
            message: userOpHash,
          });
          
          // Ensure signature is properly formatted as hex
          const signature = response.data.signature;
          const formattedSignature = signature.startsWith('0x') ? signature : `0x${signature}`;
          
          signatures.push(formattedSignature);
          publicKeys.push(response.data.publicKey);
          nodeIds.push(response.data.nodeId);
        } catch (error: any) {
          console.error(`Failed to get signature from ${node.apiEndpoint}:`, error.message);
          // Continue with other nodes
        }
      }
      
      if (signatures.length === 0) {
        throw new Error('Failed to get signatures from any BLS nodes');
      }
      
      console.log(`Got signatures from ${signatures.length} nodes`);
      
      // TODO: Implement signature aggregation
      // For now, return the first signature as placeholder
      return {
        signatures: signatures,
        publicKeys: publicKeys,
        nodeIds: nodeIds,
        signature: signatures[0], // Use first signature as main signature
        aggregatedSignature: signatures[0], // Placeholder
        messagePoint: userOpHash.startsWith('0x') ? userOpHash : `0x${userOpHash}`,
      };
      
    } catch (error: any) {
      console.error('BLS signature generation failed:', error);
      throw new Error(`BLS signature generation failed: ${error.message}`);
    }
  }

  async generateBLSSignature(
    userId: string,
    userOpHash: string,
    nodeIndices?: number[],
  ): Promise<BlsSignatureData> {
    // Get active nodes and use first 3 as indices for the local BLS generation
    const activeNodes = await this.getActiveSignerNodes();
    if (activeNodes.length < 3) {
      throw new Error('Not enough active BLS nodes available');
    }
    
    // Use local BLS generation with first 3 active nodes (indices 1,2,3)
    const autoSelectedIndices = [1, 2, 3];
    console.log(`Auto-selected BLS node indices: ${autoSelectedIndices.join(', ')}`);
    
    // Continue with the original local BLS generation method using auto-selected indices
    // Validate node indices
    const indices = autoSelectedIndices.map(n => n - 1);
    for (const index of indices) {
      if (index < 0 || index >= this.blsConfig.keyPairs.length) {
        throw new Error(
          `Auto-selected node index ${index + 1} is out of range (1-${this.blsConfig.keyPairs.length})`,
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
      console.log(`Processing node ${node.nodeName} with private key: ${node.privateKey}`);
      
      const privateKeyBytes = this.hexToBytes(node.privateKey.substring(2));
      console.log(`Private key bytes length: ${privateKeyBytes.length}`);
      
      // Convert private key to bigint
      let privateKeyBn = 0n;
      for (const byte of privateKeyBytes) {
        privateKeyBn = (privateKeyBn << 8n) + BigInt(byte);
      }
      
      console.log(`Private key as bigint: ${privateKeyBn.toString()}`);
      
      // BLS12-381 curve order (r)
      const curveOrder = 52435875175126190479447740508185965837690552500527637822603658699938581184513n;
      
      // Ensure private key is within valid range by taking modulo
      privateKeyBn = privateKeyBn % curveOrder;
      
      if (privateKeyBn <= 0n) {
        throw new Error(`Invalid private key for node ${node.nodeName}: private key must be > 0`);
      }
      
      console.log(`Private key after modulo: ${privateKeyBn.toString()}`);
      
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
    // Handle new signature format from signer nodes
    if (blsData.signatures && blsData.nodeIds) {
      // New format: pack signatures from signer nodes
      const nodeIdsLength = ethers.solidityPacked(['uint256'], [blsData.nodeIds.length]);
      const nodeIdsBytes = ethers.solidityPacked(
        Array(blsData.nodeIds.length).fill('bytes32'),
        blsData.nodeIds,
      );

      return ethers.solidityPacked(
        ['bytes', 'bytes', 'bytes', 'bytes'],
        [nodeIdsLength, nodeIdsBytes, blsData.signature, blsData.messagePoint],
      );
    }
    
    // Fallback to old format if available
    if (blsData.nodeIds && blsData.aaSignature) {
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

    throw new Error('Invalid BLS signature data format');
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