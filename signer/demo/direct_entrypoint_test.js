import { ethers } from 'ethers';
import axios from 'axios';

// 直接通过EntryPoint测试，不经过bundler
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    
    account: "0x18d9066EA77558c71286b84FcBbA924077F9E24e",
    receiver: "0x962753056921000790fb7Fe7C2dCA3006bA605f3",
    
    selectedNodes: [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
    ]
};

const ENTRY_POINT_ABI = [
    "function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external",
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)"
];

const ACCOUNT_ABI = [
    "function execute(address dest, uint256 value, bytes calldata func) external"
];

class DirectEntryPointTest {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(CONFIG.rpc);
        this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
        this.entryPoint = new ethers.Contract(CONFIG.entryPoint, ENTRY_POINT_ABI, this.wallet);
        this.account = new ethers.Contract(CONFIG.account, ACCOUNT_ABI, this.provider);
    }

    async createUserOp() {
        console.log("🔧 创建UserOperation...");
        
        const nonce = await this.entryPoint.getNonce(CONFIG.account, 0);
        console.log("账户nonce:", nonce.toString());
        
        const callData = this.account.interface.encodeFunctionData("execute", [
            CONFIG.receiver,
            ethers.parseEther("0.001"),
            "0x"
        ]);
        
        const userOp = {
            sender: CONFIG.account,
            nonce: nonce,
            initCode: "0x",
            callData: callData,
            callGasLimit: 100000n,
            verificationGasLimit: 800000n, // 使用高gas限制
            preVerificationGas: 60000n,
            maxFeePerGas: ethers.parseUnits("5", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
            paymasterAndData: "0x",
            signature: "0x"
        };
        
        console.log("✅ UserOperation创建完成");
        return userOp;
    }

    calculateUserOpHash(userOp) {
        // EntryPoint使用的hash计算方法
        const packed = ethers.solidityPacked(
            ["address", "uint256", "bytes32", "bytes32", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes32"],
            [
                userOp.sender,
                userOp.nonce,
                ethers.keccak256(userOp.initCode),
                ethers.keccak256(userOp.callData),
                userOp.callGasLimit,
                userOp.verificationGasLimit,
                userOp.preVerificationGas,
                userOp.maxFeePerGas,
                userOp.maxPriorityFeePerGas,
                ethers.keccak256(userOp.paymasterAndData)
            ]
        );
        
        const entryPointAddress = CONFIG.entryPoint;
        const chainId = 11155111; // Sepolia
        
        const fullHash = ethers.keccak256(
            ethers.solidityPacked(
                ["bytes32", "address", "uint256"],
                [ethers.keccak256(packed), entryPointAddress, chainId]
            )
        );
        
        return fullHash;
    }

    async createBLSSignature(userOpHash) {
        console.log("🔧 创建BLS+ECDSA签名...");
        console.log("UserOp hash:", userOpHash);
        
        // 获取BLS签名
        const signatures = [];
        for (let i = 0; i < 3; i++) {
            const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
                message: userOpHash
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
        
        const messageBytes = ethers.getBytes(userOpHash);
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
        
        // 创建ECDSA签名
        // 账户合约会对userOpHash做toEthSignedMessageHash()处理
        // 我们需要对应的签名，让合约验证
        const signingKey = new ethers.SigningKey(CONFIG.privateKey);
        const aaSignature = signingKey.sign(userOpHash).serialized;
        console.log("✅ ECDSA签名完成");
        
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
            console.log("捕获到预期的revert:", error.reason || error.message);
            
            // 检查是否是ValidationResult revert (正常的成功结果)
            if (error.data && error.data.startsWith("0xe0cff05f")) {
                try {
                    const resultData = "0x" + error.data.slice(10);
                    const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                        ["tuple(uint256 preOpGas, uint256 prefund, bool sigFailed, uint48 validAfter, uint48 validUntil, bytes paymasterContext)"],
                        resultData
                    );
                    
                    const result = decoded[0];
                    console.log("\n📊 验证结果:");
                    console.log("  preOpGas:", result.preOpGas.toString());
                    console.log("  prefund:", ethers.formatEther(result.prefund), "ETH");
                    console.log("  sigFailed:", result.sigFailed);
                    console.log("  validAfter:", result.validAfter.toString());
                    console.log("  validUntil:", result.validUntil.toString());
                    
                    if (!result.sigFailed) {
                        console.log("\n🎉 SUCCESS!");
                        console.log("✅ 签名验证通过!");
                        console.log("✅ Gas修复版本工作正常!");
                        console.log("✅ BLS+ERC-4337系统运行正常!");
                        return true;
                    } else {
                        console.log("\n❌ 签名验证失败");
                        console.log("需要检查:");
                        console.log("- BLS签名是否正确");
                        console.log("- ECDSA签名是否正确");
                        console.log("- 签名格式是否正确");
                        return false;
                    }
                    
                } catch (decodeError) {
                    console.log("❌ 无法解析验证结果:", decodeError.message);
                    return false;
                }
            } else {
                console.log("❌ 非预期错误:", error.message);
                if (error.data) {
                    console.log("Error data:", error.data);
                }
                return false;
            }
        }
    }

    async run() {
        console.log("🚀 直接EntryPoint验证测试");
        console.log("=".repeat(40));
        console.log("账户:", CONFIG.account);
        console.log("EntryPoint:", CONFIG.entryPoint);
        
        try {
            // 1. 创建UserOperation
            const userOp = await this.createUserOp();
            
            // 2. 计算hash
            const userOpHash = this.calculateUserOpHash(userOp);
            
            // 3. 创建签名
            const signature = await this.createBLSSignature(userOpHash);
            userOp.signature = signature;
            
            // 4. 直接验证
            const success = await this.directSimulateValidation(userOp);
            
            if (success) {
                console.log("\n🏆 测试完全成功!");
                console.log("系统可以进行实际转账了!");
            } else {
                console.log("\n❌ 验证仍然失败");
            }
            
        } catch (error) {
            console.error("❌ 测试失败:", error.message);
        }
    }
}

const test = new DirectEntryPointTest();
test.run().catch(console.error);