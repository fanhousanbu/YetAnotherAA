import { ethers } from 'ethers';
import axios from 'axios';

// 详细调试BLS签名验证过程
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    
    account: "0x18d9066EA77558c71286b84FcBbA924077F9E24e",
    validator: "0x0Fe448a612efD9B38287e25a208448315c2E2Df3",
    
    selectedNodes: [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
    ]
};

const VALIDATOR_ABI = [
    "function validateAggregateSignature(bytes32[] calldata nodeIds, bytes calldata signature, bytes calldata messagePoint) external view returns (bool isValid)"
];

const ACCOUNT_ABI = [
    "function _parseAndValidateAAStarSignature(bytes calldata signature, bytes32 userOpHash) external view returns (bool isValid)"
];

async function debugSignatureValidation() {
    console.log("🔍 详细调试BLS签名验证");
    console.log("=".repeat(50));
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
    const validator = new ethers.Contract(CONFIG.validator, VALIDATOR_ABI, provider);
    const account = new ethers.Contract(CONFIG.account, ACCOUNT_ABI, provider);
    
    // 1. 创建测试hash
    const testHash = ethers.keccak256(ethers.toUtf8Bytes("debug_test_signature"));
    console.log("📝 测试Hash:", testHash);
    
    try {
        // 2. 获取BLS签名
        console.log("\n🔧 获取BLS签名...");
        const signatures = [];
        for (let i = 0; i < 3; i++) {
            const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
                message: testHash
            });
            signatures.push(response.data.signature);
            console.log(`✅ 节点 ${i+1} 签名完成`);
        }
        
        // 3. 聚合签名
        const aggResponse = await axios.post(`http://localhost:3001/signature/aggregate`, {
            signatures: signatures
        });
        const aggregatedSignature = aggResponse.data.signature;
        console.log("✅ BLS签名聚合完成");
        
        // 4. 生成messagePoint
        console.log("\n🧮 生成MessagePoint...");
        const { bls12_381: bls } = await import('@noble/curves/bls12-381.js');
        const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
        
        const messageBytes = ethers.getBytes(testHash);
        const messagePoint_G2 = await bls.G2.hashToCurve(messageBytes, { DST });
        
        const result = new Uint8Array(256);
        const affine = messagePoint_G2.toAffine();
        
        const hexToBytes = (hex) => {
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) {
                bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
            }
            return bytes;
        };
        
        result.set(hexToBytes(affine.x.c0.toString(16).padStart(96, '0')), 16);
        result.set(hexToBytes(affine.x.c1.toString(16).padStart(96, '0')), 80);
        result.set(hexToBytes(affine.y.c0.toString(16).padStart(96, '0')), 144);
        result.set(hexToBytes(affine.y.c1.toString(16).padStart(96, '0')), 208);
        const messagePoint = "0x" + Buffer.from(result).toString('hex');
        console.log("✅ MessagePoint生成完成");
        
        // 5. 直接测试验证器
        console.log("\n🧪 直接测试验证器...");
        try {
            const isValidDirect = await validator.validateAggregateSignature(
                CONFIG.selectedNodes,
                aggregatedSignature,
                messagePoint,
                { gasLimit: 1000000 }
            );
            console.log("🎯 验证器直接验证结果:", isValidDirect ? "✅ 成功" : "❌ 失败");
            
            if (!isValidDirect) {
                console.log("\n❌ 验证器直接验证失败!");
                console.log("可能原因:");
                console.log("- BLS签名不正确");
                console.log("- MessagePoint计算错误");
                console.log("- 节点公钥不匹配");
                return;
            }
            
        } catch (error) {
            console.log("❌ 验证器直接调用失败:", error.message);
            return;
        }
        
        // 6. 创建完整的ECDSA+BLS签名
        console.log("\n✍️ 创建完整签名...");
        const aaSignature = await wallet.signMessage(ethers.getBytes(testHash));
        console.log("✅ ECDSA签名完成");
        
        // 7. 打包签名
        const nodeIdsLength = ethers.solidityPacked(["uint256"], [CONFIG.selectedNodes.length]);
        const nodeIdsBytes = ethers.solidityPacked(
            Array(CONFIG.selectedNodes.length).fill("bytes32"),
            CONFIG.selectedNodes
        );
        
        const packedSignature = ethers.solidityPacked(
            ["bytes", "bytes", "bytes", "bytes", "bytes"],
            [
                nodeIdsLength,
                nodeIdsBytes,
                aggregatedSignature,
                messagePoint,
                aaSignature
            ]
        );
        
        console.log("✅ 签名打包完成, 长度:", (packedSignature.length / 2 - 1), "字节");
        
        // 8. 测试账户的签名验证
        console.log("\n🏠 测试账户签名验证...");
        try {
            const isValidAccount = await account._parseAndValidateAAStarSignature(
                packedSignature,
                testHash,
                { gasLimit: 1000000 }
            );
            console.log("🎯 账户验证结果:", isValidAccount ? "✅ 成功" : "❌ 失败");
            
            if (!isValidAccount) {
                console.log("\n❌ 账户验证失败的可能原因:");
                console.log("1. ECDSA签名验证失败 (owner不匹配)");
                console.log("2. BLS签名解析错误");
                console.log("3. 签名格式不正确");
                
                // 详细检查owner
                const hash = ethers.hashMessage(ethers.getBytes(testHash));
                const recoveredSigner = ethers.recoverAddress(hash, aaSignature);
                const expectedOwner = wallet.address;
                
                console.log("\n🔍 ECDSA签名验证详情:");
                console.log("Expected owner:", expectedOwner);
                console.log("Recovered signer:", recoveredSigner);
                console.log("Match:", recoveredSigner.toLowerCase() === expectedOwner.toLowerCase() ? "✅" : "❌");
                
                if (recoveredSigner.toLowerCase() !== expectedOwner.toLowerCase()) {
                    console.log("❌ ECDSA签名恢复的地址不匹配!");
                } else {
                    console.log("❌ ECDSA正确，问题可能在BLS部分");
                }
            }
            
        } catch (error) {
            console.log("❌ 账户验证调用失败:", error.message);
            
            // 如果是revert，尝试解析原因
            if (error.data) {
                console.log("Revert data:", error.data);
            }
        }
        
    } catch (error) {
        console.log("❌ 调试失败:", error.message);
    }
}

debugSignatureValidation().catch(console.error);