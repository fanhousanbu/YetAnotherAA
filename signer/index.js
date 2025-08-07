#!/usr/bin/env node

import { bls12_381 } from '@noble/curves/bls12-381.js';
import { sha256 } from '@noble/hashes/sha256';
import { randomBytes } from 'crypto';

/**
 * AA Aggregate Signature Generator
 * 
 * Generates aggregate signatures for ERC4337 Account Abstraction wallets
 * - Multi-party signature aggregation for AA multi-sig scenarios
 * - EIP-2537 compatible output for efficient on-chain validation
 * - Support for validator consensus and batch operations
 * - Integration-ready data for AggregateSignatureValidator contract
 */

// 命令行参数解析
function parseArgs() {
    const args = process.argv.slice(2);
    const config = {
        message: null,
        m: 0,
        n: 0
    };
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--message' && i + 1 < args.length) {
            config.message = args[i + 1];
            i++;
        } else if (args[i] === '--m' && i + 1 < args.length) {
            config.m = parseInt(args[i + 1]);
            i++;
        } else if (args[i] === '--n' && i + 1 < args.length) {
            config.n = parseInt(args[i + 1]);
            i++;
        }
    }
    
    return config;
}

// 转换为 EIP-2537 格式 (128字节G1点)
function encodeG1Point(point) {
    const result = new Uint8Array(128);
    
    // 获取仿射坐标
    const affine = point.toAffine();
    
    // 将坐标转换为字节数组
    const xBytes = hexToBytes(affine.x.toString(16).padStart(96, '0'));
    const yBytes = hexToBytes(affine.y.toString(16).padStart(96, '0'));
    
    // EIP-2537格式：[16个0][48字节x][16个0][48字节y]
    result.set(xBytes, 16);
    result.set(yBytes, 80);
    
    return result;
}

// 转换为 EIP-2537 格式 (256字节G2点)
function encodeG2Point(point) {
    const result = new Uint8Array(256);
    
    // 获取仿射坐标
    const affine = point.toAffine();
    
    // G2点的坐标是Fp2元素，每个有两个分量
    // x = x0 + x1*u, y = y0 + y1*u
    const x0Bytes = hexToBytes(affine.x.c0.toString(16).padStart(96, '0'));
    const x1Bytes = hexToBytes(affine.x.c1.toString(16).padStart(96, '0'));
    const y0Bytes = hexToBytes(affine.y.c0.toString(16).padStart(96, '0'));
    const y1Bytes = hexToBytes(affine.y.c1.toString(16).padStart(96, '0'));
    
    // EIP-2537格式：[16个0][48字节x0][16个0][48字节x1][16个0][48字节y0][16个0][48字节y1]
    result.set(x0Bytes, 16);
    result.set(x1Bytes, 80);
    result.set(y0Bytes, 144);
    result.set(y1Bytes, 208);
    
    return result;
}

// 将点取负
function negateG1Point(point) {
    return point.negate();
}

// 辅助函数：十六进制字符串转字节数组
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

// 构建配对输入数据
function buildPairingInput(g1Generator, aggregatedSignature, negatedAggregatedPubKey, messageG2) {
    const input = new Uint8Array(768); // 2个配对 × 384字节
    
    // 第一个配对: (G1生成元, aggregatedSignature)
    input.set(encodeG1Point(g1Generator), 0);
    input.set(encodeG2Point(aggregatedSignature), 128);
    
    // 第二个配对: (-aggregatedPubKey, messageG2)  
    input.set(encodeG1Point(negatedAggregatedPubKey), 384);
    input.set(encodeG2Point(messageG2), 512);
    
    return input;
}

// 主函数
async function main() {
    const config = parseArgs();
    
    // 验证参数
    if (!config.message || config.m <= 0 || config.n <= 0 || config.n > config.m) {
        console.error('用法: node index.js --message "hello world" --m 5 --n 3');
        console.error('  --message: 要签名的消息');
        console.error('  --m: 生成的私钥总数');
        console.error('  --n: 用于聚合的私钥数量 (n <= m)');
        process.exit(1);
    }
    
    console.log('开始BLS签名聚合过程...');
    console.log(`消息: ${config.message}`);
    console.log(`生成私钥数量: ${config.m}`);
    console.log(`聚合签名数量: ${config.n}`);
    
    const message = new TextEncoder().encode(config.message);
    const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
    
    // 使用长签名模式 (G2签名, G1公钥)
    const bls = bls12_381;
    
    // 1. 生成m个私钥和公钥
    console.log('\n=== 生成私钥和公钥 ===');
    const privateKeys = [];
    const publicKeys = [];
    
    for (let i = 0; i < config.m; i++) {
        const privKey = randomBytes(32);
        const pubKey = bls.getPublicKey(privKey);
        
        privateKeys.push(privKey);
        publicKeys.push(pubKey);
        
        console.log(`私钥 ${i}: 0x${Buffer.from(privKey).toString('hex')}`);
        console.log(`公钥 ${i}: 0x${Buffer.from(pubKey).toString('hex')}`);
    }
    
    // 2. 随机选择n个私钥进行聚合
    console.log(`\n=== 随机选择 ${config.n} 个私钥进行聚合 ===`);
    const selectedIndices = [];
    while (selectedIndices.length < config.n) {
        const index = Math.floor(Math.random() * config.m);
        if (!selectedIndices.includes(index)) {
            selectedIndices.push(index);
        }
    }
    selectedIndices.sort((a, b) => a - b);
    console.log(`选中的索引: [${selectedIndices.join(', ')}]`);
    
    // 3. 使用选中的私钥生成签名
    console.log('\n=== 生成个人签名 ===');
    const selectedPrivateKeys = selectedIndices.map(i => privateKeys[i]);
    const selectedPublicKeys = selectedIndices.map(i => publicKeys[i]);
    const signatures = [];
    
    for (let i = 0; i < selectedPrivateKeys.length; i++) {
        const signature = bls.sign(message, selectedPrivateKeys[i]);
        signatures.push(signature);
        
        // 验证个人签名
        const isValid = bls.verify(signature, message, selectedPublicKeys[i]);
        console.log(`签名 ${selectedIndices[i]}: 0x${Buffer.from(signature).toString('hex')} (验证: ${isValid})`);
    }
    
    // 4. 聚合签名和公钥
    console.log('\n=== 聚合签名和公钥 ===');
    const aggregatedSignature = bls.aggregateSignatures(signatures);
    const aggregatedPubKey = bls.aggregatePublicKeys(selectedPublicKeys);
    
    console.log(`聚合签名: 0x${Buffer.from(aggregatedSignature).toString('hex')}`);
    console.log(`聚合公钥: 0x${Buffer.from(aggregatedPubKey).toString('hex')}`);
    
    // 5. 验证聚合签名
    const isAggregatedValid = bls.verify(aggregatedSignature, message, aggregatedPubKey);
    console.log(`聚合签名验证: ${isAggregatedValid}`);
    
    if (!isAggregatedValid) {
        console.error('聚合签名验证失败！');
        process.exit(1);
    }
    
    // 6. 生成合约验证所需的数据
    console.log('\n=== 生成合约验证数据 ===');
    
    // 将消息映射到G2
    const messageG2Point = bls.G2.hashToCurve(message, DST);
    
    // G1生成元
    const g1Generator = bls.G1.ProjectivePoint.BASE;
    
    // 将聚合公钥取负 (用于配对验证)
    const negatedAggregatedPubKey = negateG1Point(bls.G1.ProjectivePoint.fromAffine(bls.G1.ProjectivePoint.fromHex(aggregatedPubKey).toAffine()));
    
    // 转换为EIP-2537格式
    const aggregatedPubKeyEIP = encodeG1Point(bls.G1.ProjectivePoint.fromHex(aggregatedPubKey));
    const negatedPubKeyEIP = encodeG1Point(negatedAggregatedPubKey);
    const aggregatedSignatureEIP = encodeG2Point(bls.G2.ProjectivePoint.fromHex(aggregatedSignature));
    const messageG2EIP = encodeG2Point(messageG2Point);
    
    // 生成配对输入数据
    const pairingCalldata = buildPairingInput(g1Generator, 
        bls.G2.ProjectivePoint.fromHex(aggregatedSignature), 
        negatedAggregatedPubKey, 
        messageG2Point);
    
    // 输出结果
    console.log('\n=== AA Signature Validation Data ===');
    console.log('For validateSignature(bytes):');
    console.log(`  pairingData: "0x${Buffer.from(pairingCalldata).toString('hex')}"`);
    
    console.log('\nFor validateComponents(bytes,bytes,bytes):');
    console.log(`  aggregatedKey: "0x${Buffer.from(negatedPubKeyEIP).toString('hex')}"`);
    console.log(`  signature: "0x${Buffer.from(aggregatedSignatureEIP).toString('hex')}"`);
    console.log(`  messagePoint: "0x${Buffer.from(messageG2EIP).toString('hex')}"`);
    
    console.log('\nFor validateUserOp(bytes32,bytes):');
    console.log(`  userOpHash: "0x[32-byte-user-op-hash]"`);
    console.log(`  signatureData: "0x${Buffer.from(pairingCalldata).toString('hex')}" (direct mode)`);
    
    // JSON格式输出 - AA兼容格式
    const aaSignatureData = {
        // Primary validation method
        pairingData: "0x" + Buffer.from(pairingCalldata).toString('hex'),
        
        // Component validation
        components: {
            aggregatedKey: "0x" + Buffer.from(negatedPubKeyEIP).toString('hex'),
            signature: "0x" + Buffer.from(aggregatedSignatureEIP).toString('hex'),
            messagePoint: "0x" + Buffer.from(messageG2EIP).toString('hex')
        },
        
        // ERC4337 UserOp format
        userOpSignature: {
            direct: "0x" + Buffer.from(pairingCalldata).toString('hex'),
            components: "0x" + 
                Buffer.from(negatedPubKeyEIP).toString('hex') +
                Buffer.from(aggregatedSignatureEIP).toString('hex').slice(2) +
                Buffer.from(messageG2EIP).toString('hex').slice(2)
        },
        
        // Contract methods
        contractMethods: {
            validateSignature: `validateSignature(bytes)`,
            validateComponents: `validateComponents(bytes,bytes,bytes)`,
            validateUserOp: `validateUserOp(bytes32,bytes)`
        }
    };
    
    console.log('\n=== AA Integration JSON ===');
    console.log(JSON.stringify(aaSignatureData, null, 2));
}

// 运行主函数
main().catch(console.error);