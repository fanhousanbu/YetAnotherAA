#!/usr/bin/env node
/**
 * AAStarValidator Off-chain Signature Tool
 * Function: Generate BLS aggregate signatures and output on-chain contract call parameters
 */

import { bls12_381 } from '@noble/curves/bls12-381.js';
import { ethers } from 'ethers';
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

// Generate simulated ERC-4337 userOpHash
function generateMockUserOpHash() {
    // Simulate a typical ERC-4337 UserOperation structure
    const mockUserOp = {
        sender: "0x1234567890123456789012345678901234567890",
        nonce: "0x1",
        initCode: "0x",
        callData: "0xabcdef1234567890",
        callGasLimit: "0x5208",
        verificationGasLimit: "0x5208",
        preVerificationGas: "0x5208",
        maxFeePerGas: "0x3b9aca00",
        maxPriorityFeePerGas: "0x3b9aca00",
        paymasterAndData: "0x",
        signature: "0x"
    };
    
    // Create userOpHash using ethers.js keccak256
    const packedUserOp = ethers.solidityPacked(
        ["address", "uint256", "bytes", "bytes", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes"],
        [
            mockUserOp.sender,
            mockUserOp.nonce,
            mockUserOp.initCode,
            mockUserOp.callData,
            mockUserOp.callGasLimit,
            mockUserOp.verificationGasLimit,
            mockUserOp.preVerificationGas,
            mockUserOp.maxFeePerGas,
            mockUserOp.maxPriorityFeePerGas,
            mockUserOp.paymasterAndData
        ]
    );
    
    return ethers.keccak256(packedUserOp);
}

// Main function: Generate on-chain verification parameters
export async function generateContractCallParams(userOpHash = null, nodeIndices = [1, 2, 3]) {
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
    
    // Generate userOpHash if not provided
    if (!userOpHash) {
        userOpHash = generateMockUserOpHash();
    }
    
    // BLS signature parameters
    const messageBytes = ethers.getBytes(userOpHash);
    // const messageBytes = new TextEncoder().encode(userOpHash);
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
        
        console.log(`🔑 节点 ${node.nodeName} (ID: ${node.contractNodeId}) 生成的签名:`, signature.toHex());
        
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
    
    // Generate ECDSA signature for AA account (sign userOpHash for security binding)
    const aaAccount = contractConfig.aaAccount;
    const wallet = new ethers.Wallet(aaAccount.privateKey);
    // SECURITY: AA signature must validate userOpHash (ensures binding to specific userOp)
    const aaSignature = await wallet.signMessage(ethers.getBytes(userOpHash));
    
    // Pack signature according to contract format:
    // [nodeIdsLength(32)][nodeIds...][blsSignature(256)][messagePoint(256)][aaSignature(65)]
    const nodeIdsLength = nodeIds.length;
    const nodeIdsLengthBytes = ethers.solidityPacked(["uint256"], [nodeIdsLength]);
    const nodeIdsBytes = ethers.solidityPacked(nodeIds.map(() => "bytes32"), nodeIds);
    const packedSignature = ethers.solidityPacked(
        ["bytes", "bytes", "bytes", "bytes", "bytes"],
        [
            nodeIdsLengthBytes,
            nodeIdsBytes,
            "0x" + Buffer.from(aggregatedSignatureEIP).toString('hex'),
            "0x" + Buffer.from(messageG2EIP).toString('hex'),
            aaSignature
        ]
    );

    return {
        nodeIds: nodeIds,
        signature: "0x" + Buffer.from(aggregatedSignatureEIP).toString('hex'),
        messagePoint: "0x" + Buffer.from(messageG2EIP).toString('hex'),
        aaAddress: aaAccount.address,
        aaSignature: aaSignature,
        packedSignature: packedSignature,  // 新增：打包后的签名
        contractAddress: contractConfig.contractAddress,
        userOpHash: userOpHash,
        participantNodes: selectedNodes.map(node => ({
            nodeId: node.contractNodeId,
            nodeName: node.nodeName
        }))
    };
}

// CLI interface
async function main() {
    const args = process.argv.slice(2);
    
    let userOpHash = null;
    let nodeIndicesStr = '1,2,3';
    
    if (args.length > 0) {
        if (args[0].startsWith('0x')) {
            // First argument is a userOpHash
            userOpHash = args[0];
            nodeIndicesStr = args[1] || '1,2,3';
        } else {
            // First argument is node indices
            nodeIndicesStr = args[0];
        }
    }
    
    const nodeIndices = nodeIndicesStr.split(',').map(n => parseInt(n.trim()));
    
    try {
        const params = await generateContractCallParams(userOpHash, nodeIndices);
        
        console.log('🔐 On-chain verification parameters generated successfully\n');
        console.log(`🧾 UserOpHash: "${params.userOpHash}"`);
        console.log(`👥 Nodes: ${nodeIndices.join(', ')}\n`);
        
        console.log('💻 Contract call parameters:');
        console.log(`nodeIds: [${params.nodeIds.map(id => `"${id}"`).join(', ')}]`);
        console.log(`signature: "${params.signature}"`);
        console.log(`messagePoint: "${params.messagePoint}"`);
        console.log(`aaAddress: "${params.aaAddress}"`);
        console.log(`aaSignature: "${params.aaSignature}"`);
        
        console.log('\n📋 Solidity code:');
        console.log(`bytes32[] memory nodeIds = new bytes32[](${params.nodeIds.length});`);
        params.nodeIds.forEach((id, i) => {
            console.log(`nodeIds[${i}] = ${id};`);
        });
        console.log(`\nbool isValid = validator.verifyAggregateSignature(`);
        console.log(`  nodeIds,`);
        console.log(`  hex"${params.signature.substring(2)}",`);
        console.log(`  hex"${params.messagePoint.substring(2)}",`);
        console.log(`  ${params.aaAddress},`);
        console.log(`  hex"${params.aaSignature.substring(2)}"`);
        console.log(`);`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// 如果直接运行脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}