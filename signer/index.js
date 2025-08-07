#!/usr/bin/env node
/**
 * AAStarValidator Off-chain Signature Tool
 * Function: Generate BLS aggregate signatures and output on-chain contract call parameters
 */

import { bls12_381 } from '@noble/curves/bls12-381.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// EIP-2537 format encoding (G2 point, 256 bytes)
function encodeG2Point(point) {
    const result = new Uint8Array(256);
    const affine = point.toAffine();
    
    const x0Bytes = hexToBytes(affine.x.c0.toString(16).padStart(96, '0'));
    const x1Bytes = hexToBytes(affine.x.c1.toString(16).padStart(96, '0'));
    const y0Bytes = hexToBytes(affine.y.c0.toString(16).padStart(96, '0'));
    const y1Bytes = hexToBytes(affine.y.c1.toString(16).padStart(96, '0'));
    
    result.set(x0Bytes, 16);
    result.set(x1Bytes, 80);
    result.set(y0Bytes, 144);
    result.set(y1Bytes, 208);
    return result;
}

// Convert hexadecimal string to byte array
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

// Main function: Generate on-chain verification parameters
export async function generateContractCallParams(message, nodeIndices = [1, 2, 3]) {
    // Read registered node configuration
    const contractConfig = JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf8'));
    
    // Validate node indices
    const indices = nodeIndices.map(n => n - 1);
    for (const index of indices) {
        if (index < 0 || index >= contractConfig.keyPairs.length) {
            throw new Error(`Node index ${index + 1} is out of range (1-${contractConfig.keyPairs.length})`);
        }
    }
    
    // Get selected nodes
    const selectedNodes = indices.map(i => contractConfig.keyPairs[i]);
    
    // BLS signature parameters
    const messageBytes = new TextEncoder().encode(message);
    const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
    const bls = bls12_381;
    const sigs = bls.longSignatures;
    
    // Generate G2 point for the message
    const messagePoint = await bls.G2.hashToCurve(messageBytes, { DST });
    
    // Generate signature for each selected node
    const signatures = [];
    const publicKeys = [];
    const nodeIds = [];
    
    for (const node of selectedNodes) {
        const privateKeyBytes = hexToBytes(node.privateKey.substring(2));
        const publicKey = sigs.getPublicKey(privateKeyBytes);
        const signature = await sigs.sign(messagePoint, privateKeyBytes);
        
        signatures.push(signature);
        publicKeys.push(publicKey);
        nodeIds.push(node.contractNodeId);
    }
    
    // Aggregate signatures
    const aggregatedSignature = sigs.aggregateSignatures(signatures);
    const aggregatedPubKey = sigs.aggregatePublicKeys(publicKeys);
    
    // Verify aggregate signature
    const isValid = await sigs.verify(aggregatedSignature, messagePoint, aggregatedPubKey);
    if (!isValid) {
        throw new Error('Aggregate signature verification failed');
    }
    
    // Convert to contract format
    const aggregatedSignatureEIP = encodeG2Point(bls.G2.Point.fromHex(aggregatedSignature.toBytes()));
    const messageG2EIP = encodeG2Point(messagePoint);
    
    return {
        nodeIds: nodeIds,
        signature: "0x" + Buffer.from(aggregatedSignatureEIP).toString('hex'),
        messagePoint: "0x" + Buffer.from(messageG2EIP).toString('hex'),
        contractAddress: contractConfig.contractAddress,
        participantNodes: selectedNodes.map(node => ({
            nodeId: node.contractNodeId,
            nodeName: node.nodeName
        }))
    };
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0) {
        console.log('Usage: node index.js "message content" [node indices]');
        console.log('Example: node index.js "Hello World" 1,2,3');
        return;
    }

    const message = args[0];
    const nodeIndicesStr = args[1] || '1,2,3';
    const nodeIndices = nodeIndicesStr.split(',').map(n => parseInt(n.trim()));
    
    try {
        const params = await generateContractCallParams(message, nodeIndices);
        
        console.log('🔐 On-chain verification parameters generated successfully\n');
        console.log(`📝 Message: "${message}"`);
        console.log(`👥 Nodes: ${nodeIndices.join(', ')}\n`);
        
        console.log('💻 Contract call parameters:');
        console.log(`nodeIds: [${params.nodeIds.map(id => `"${id}"`).join(', ')}]`);
        console.log(`signature: "${params.signature}"`);
        console.log(`messagePoint: "${params.messagePoint}"`);
        
        console.log('\n📋 Solidity code:');
        console.log(`bytes32[] memory nodeIds = new bytes32[](${params.nodeIds.length});`);
        params.nodeIds.forEach((id, i) => {
            console.log(`nodeIds[${i}] = ${id};`);
        });
        console.log(`\nbool isValid = validator.verifyAggregateSignature(`);
        console.log(`  nodeIds,`);
        console.log(`  hex"${params.signature.substring(2)}",`);
        console.log(`  hex"${params.messagePoint.substring(2)}"`);
        console.log(`);`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// 如果直接运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}