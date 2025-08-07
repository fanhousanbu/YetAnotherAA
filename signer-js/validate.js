#!/usr/bin/env node

import { bls12_381 } from '@noble/curves/bls12-381.js';

// 验证生成的EIP-2537格式点是否正确
function validateEIP2537Format() {
    console.log("=== EIP-2537 格式验证 ===");
    
    // 1. 验证G1生成元
    const g1Generator = bls12_381.G1.ProjectivePoint.BASE;
    console.log("\n--- G1生成元验证 ---");
    
    const g1Compressed = g1Generator.toRawBytes(true);
    console.log("压缩格式 (48字节):", Buffer.from(g1Compressed).toString('hex'));
    
    // 验证压缩格式是否正确
    try {
        const reconstructed = bls12_381.G1.ProjectivePoint.fromHex(g1Compressed);
        console.log("✅ G1生成元压缩格式有效");
        
        // 获取仿射坐标
        const affine = reconstructed.toAffine();
        console.log("x坐标:", affine.x.toString(16).padStart(96, '0'));
        console.log("y坐标:", affine.y.toString(16).padStart(96, '0'));
        
    } catch (e) {
        console.log("❌ G1生成元压缩格式无效:", e.message);
    }
    
    // 2. 创建EIP-2537格式的G1点
    function createEIP2537G1(point) {
        const affine = point.toAffine();
        const result = new Uint8Array(128);
        
        // 将坐标转换为字节数组
        const xBytes = hexToBytes(affine.x.toString(16).padStart(96, '0'));
        const yBytes = hexToBytes(affine.y.toString(16).padStart(96, '0'));
        
        // EIP-2537格式：[16个0][48字节x][16个0][48字节y]
        result.set(xBytes, 16);
        result.set(yBytes, 80);
        
        return result;
    }
    
    function createEIP2537G2(point) {
        const affine = point.toAffine();
        const result = new Uint8Array(256);
        
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
    
    // 辅助函数
    function hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }
    
    // 3. 测试G1生成元的EIP-2537格式
    const g1EIP = createEIP2537G1(g1Generator);
    console.log("\n--- G1生成元 EIP-2537格式 ---");
    console.log("完整128字节:", Buffer.from(g1EIP).toString('hex'));
    console.log("x坐标部分:", Buffer.from(g1EIP.slice(16, 64)).toString('hex'));
    console.log("y坐标部分:", Buffer.from(g1EIP.slice(80, 128)).toString('hex'));
    
    // 4. 测试完整的BLS流程
    console.log("\n--- 完整BLS测试 ---");
    const privateKey = new Uint8Array(32).fill(1);
    const publicKey = bls12_381.getPublicKey(privateKey);
    const message = new TextEncoder().encode("test");
    const signature = bls12_381.sign(message, privateKey);
    
    // 聚合（虽然只有一个）
    const aggPubKey = bls12_381.G1.ProjectivePoint.fromHex(publicKey);
    const aggSig = bls12_381.G2.ProjectivePoint.fromHex(signature);
    
    // 生成messageG2
    const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
    const messageG2 = bls12_381.G2.hashToCurve(message, DST);
    
    // 生成EIP-2537格式
    const g1GenEIP = createEIP2537G1(g1Generator);
    const aggPubKeyEIP = createEIP2537G1(aggPubKey);
    const negAggPubKeyEIP = createEIP2537G1(aggPubKey.negate());
    const aggSigEIP = createEIP2537G2(aggSig);
    const messageG2EIP = createEIP2537G2(messageG2);
    
    console.log("聚合公钥EIP格式:", Buffer.from(aggPubKeyEIP).toString('hex'));
    console.log("取负聚合公钥EIP格式:", Buffer.from(negAggPubKeyEIP).toString('hex'));
    
    // 构建配对数据
    const pairingData = new Uint8Array(768);
    pairingData.set(g1GenEIP, 0);           // G1生成元
    pairingData.set(aggSigEIP, 128);        // 聚合签名
    pairingData.set(negAggPubKeyEIP, 384);  // 取负的聚合公钥
    pairingData.set(messageG2EIP, 512);     // messageG2
    
    console.log("\n--- 最终配对数据 ---");
    console.log("768字节配对数据:", Buffer.from(pairingData).toString('hex'));
    
    // 验证BLS签名本身
    const isValid = bls12_381.verify(signature, message, publicKey);
    console.log("BLS签名验证:", isValid);
}

validateEIP2537Format();