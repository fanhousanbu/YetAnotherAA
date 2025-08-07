#!/usr/bin/env node

import { bls12_381 } from '@noble/curves/bls12-381.js';

// 调试Noble curves的输出格式
function debugPointFormats() {
    // 生成一个测试点
    const privateKey = new Uint8Array(32).fill(1); // 固定私钥用于调试
    const publicKey = bls12_381.getPublicKey(privateKey);
    const message = new TextEncoder().encode("test");
    const signature = bls12_381.sign(message, privateKey);
    
    console.log("=== Noble Curves调试信息 ===");
    
    // G1点调试
    const g1Point = bls12_381.G1.ProjectivePoint.fromHex(publicKey);
    console.log("\n--- G1点信息 ---");
    console.log("压缩格式 (48字节):", Buffer.from(g1Point.toRawBytes(true)).toString('hex'));
    console.log("未压缩格式 (97字节):", Buffer.from(g1Point.toRawBytes(false)).toString('hex'));
    
    const uncompressedG1 = g1Point.toRawBytes(false);
    console.log("未压缩格式分析:");
    console.log("- 前缀:", uncompressedG1[0].toString(16));
    console.log("- x坐标 (48字节):", Buffer.from(uncompressedG1.slice(1, 49)).toString('hex'));
    console.log("- y坐标 (48字节):", Buffer.from(uncompressedG1.slice(49, 97)).toString('hex'));
    
    // G2点调试
    const g2Point = bls12_381.G2.ProjectivePoint.fromHex(signature);
    console.log("\n--- G2点信息 ---");
    console.log("压缩格式 (96字节):", Buffer.from(g2Point.toRawBytes(true)).toString('hex'));
    console.log("未压缩格式 (193字节):", Buffer.from(g2Point.toRawBytes(false)).toString('hex'));
    
    const uncompressedG2 = g2Point.toRawBytes(false);
    console.log("未压缩格式分析:");
    console.log("- 前缀:", uncompressedG2[0].toString(16));
    console.log("- x0坐标 (48字节):", Buffer.from(uncompressedG2.slice(1, 49)).toString('hex'));
    console.log("- x1坐标 (48字节):", Buffer.from(uncompressedG2.slice(49, 97)).toString('hex'));
    console.log("- y0坐标 (48字节):", Buffer.from(uncompressedG2.slice(97, 145)).toString('hex'));
    console.log("- y1坐标 (48字节):", Buffer.from(uncompressedG2.slice(145, 193)).toString('hex'));
    
    // 测试G1生成元
    const g1Generator = bls12_381.G1.ProjectivePoint.BASE;
    console.log("\n--- G1生成元信息 ---");
    console.log("压缩格式:", Buffer.from(g1Generator.toRawBytes(true)).toString('hex'));
    console.log("未压缩格式:", Buffer.from(g1Generator.toRawBytes(false)).toString('hex'));
    
    const uncompressedGen = g1Generator.toRawBytes(false);
    console.log("生成元坐标:");
    console.log("- x坐标:", Buffer.from(uncompressedGen.slice(1, 49)).toString('hex'));
    console.log("- y坐标:", Buffer.from(uncompressedGen.slice(49, 97)).toString('hex'));
}

debugPointFormats();