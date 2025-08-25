import { ethers } from 'ethers';
import axios from 'axios';

// 使用demo.js的相同hash进行测试
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    
    account: "0x18d9066EA77558c71286b84FcBbA924077F9E24e",
    
    // 使用demo.js的固定hash
    demoUserOpHash: "0x3e6f028455dcbace3dec0eb5e718ba5a16c2573a5fbadeec4a623392f06bde48",
    
    selectedNodes: [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
    ]
};

const ACCOUNT_ABI = [
    "function execute(address dest, uint256 value, bytes calldata func) external"
];

const ENTRY_POINT_ABI = [
    "function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external",
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)"
];

class TestWithDemoHash {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(CONFIG.rpc);
        this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
        this.entryPoint = new ethers.Contract(CONFIG.entryPoint, ENTRY_POINT_ABI, this.wallet);
        this.account = new ethers.Contract(CONFIG.account, ACCOUNT_ABI, this.provider);
    }

    async createBLSSignatureWithDemoHash() {
        console.log("🔧 使用demo.js的hash创建BLS+ECDSA签名...");
        console.log("Demo hash:", CONFIG.demoUserOpHash);
        
        // 获取BLS签名
        const signatures = [];
        for (let i = 0; i < 3; i++) {
            const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
                message: CONFIG.demoUserOpHash
            });
            signatures.push(response.data.signature);
            console.log(`✅ 节点 ${i+1} BLS签名完成`);
        }
        
        // 聚合BLS签名
        const aggResponse = await axios.post(`http://localhost:3001/signature/aggregate`, {
            signatures: signatures
        });
        const aggregatedSignature = aggResponse.data.signature;
        console.log("✅ BLS签名聚合完成");
        
        // 生成messagePoint
        const { bls12_381: bls } = await import('@noble/curves/bls12-381.js');
        const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
        
        const messageBytes = ethers.getBytes(CONFIG.demoUserOpHash);
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
        
        // 创建ECDSA签名 (使用demo.js的方式)
        const aaSignature = await this.wallet.signMessage(ethers.getBytes(CONFIG.demoUserOpHash));
        console.log("✅ ECDSA签名完成");
        console.log("ECDSA签名:", aaSignature);
        
        // 对比demo.js的签名
        const demoAASignature = "0xb7a46001582df9cdc9bd470697a5a2d5d63536968256f52692c3f1a4443160e507d7828df602e94da725aeb74a5adb978281cc4b3c41280517fad1f645ce4a661b";
        console.log("Demo ECDSA:", demoAASignature);
        console.log("签名匹配:", aaSignature === demoAASignature ? "✅" : "❌");
        
        // 打包完整签名
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
        
        console.log(`✅ 签名打包完成 (${packedSignature.length / 2 - 1} 字节)`);
        return packedSignature;
    }

    async createMockUserOp() {
        console.log("🔧 创建模拟UserOperation...");
        
        // 使用一个简单的nonce，与实际状态无关
        const mockUserOp = {
            sender: CONFIG.account,
            nonce: 0n, // 使用固定nonce
            initCode: "0x",
            callData: this.account.interface.encodeFunctionData("execute", [
                "0x962753056921000790fb7Fe7C2dCA3006bA605f3",
                ethers.parseEther("0.001"),
                "0x"
            ]),
            callGasLimit: 100000n,
            verificationGasLimit: 800000n,
            preVerificationGas: 60000n,
            maxFeePerGas: ethers.parseUnits("5", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
            paymasterAndData: "0x",
            signature: "0x" // 稍后填充
        };
        
        // 验证hash计算
        const packed = ethers.solidityPacked(
            ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
            [
                mockUserOp.sender,
                mockUserOp.nonce,
                ethers.keccak256(mockUserOp.initCode),
                ethers.keccak256(mockUserOp.callData),
                mockUserOp.callGasLimit,
                mockUserOp.verificationGasLimit,
                mockUserOp.preVerificationGas,
                mockUserOp.maxFeePerGas,
                mockUserOp.maxPriorityFeePerGas,
                ethers.keccak256(mockUserOp.paymasterAndData)
            ]
        );
        
        const calculatedHash = ethers.keccak256(packed);
        console.log("计算的hash:", calculatedHash);
        console.log("Demo hash:  ", CONFIG.demoUserOpHash);
        console.log("Hash匹配:", calculatedHash === CONFIG.demoUserOpHash ? "✅" : "❌");
        
        return mockUserOp;
    }

    async directSimulateValidation(userOp) {
        console.log("\n🎯 直接调用EntryPoint simulateValidation...");
        
        try {
            const userOpArray = [
                userOp.sender,
                userOp.nonce,
                userOp.initCode,
                userOp.callData,
                userOp.callGasLimit,
                userOp.verificationGasLimit,
                userOp.preVerificationGas,
                userOp.maxFeePerGas,
                userOp.maxPriorityFeePerGas,
                userOp.paymasterAndData,
                userOp.signature
            ];
            
            await this.entryPoint.simulateValidation(userOpArray);
            console.log("✅ 验证成功 - 这不应该发生!");
            return true;
            
        } catch (error) {
            if (error.data && error.data.startsWith("0xe0cff05f")) {
                try {
                    const resultData = "0x" + error.data.slice(10);
                    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                        ["tuple(uint256 preOpGas, uint256 prefund, bool sigFailed, uint48 validAfter, uint48 validUntil, bytes paymasterContext)"],
                        resultData
                    );
                    
                    const result = decoded[0];
                    console.log("\n📊 验证结果:");
                    console.log("  sigFailed:", result.sigFailed);
                    
                    if (!result.sigFailed) {
                        console.log("🎉 SUCCESS! 使用demo hash验证通过!");
                        return true;
                    } else {
                        console.log("❌ 使用demo hash仍然失败");
                        return false;
                    }
                    
                } catch (decodeError) {
                    console.log("❌ 无法解析验证结果:", decodeError.message);
                    return false;
                }
            } else {
                console.log("❌ 非预期错误:", error.message);
                return false;
            }
        }
    }

    async run() {
        console.log("🚀 使用Demo Hash进行EntryPoint验证测试");
        console.log("=".repeat(50));
        
        try {
            // 1. 创建模拟UserOperation
            const userOp = await this.createMockUserOp();
            
            // 2. 创建签名 (使用demo hash)
            const signature = await this.createBLSSignatureWithDemoHash();
            userOp.signature = signature;
            
            // 3. 直接验证
            const success = await this.directSimulateValidation(userOp);
            
            if (success) {
                console.log("\n🏆 验证成功!");
                console.log("问题在于hash计算方法的差异");
            } else {
                console.log("\n❌ 即使使用demo hash也失败");
            }
            
        } catch (error) {
            console.error("❌ 测试失败:", error.message);
        }
    }
}

const test = new TestWithDemoHash();
test.run().catch(console.error);