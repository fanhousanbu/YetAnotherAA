import { ethers } from 'ethers';
import axios from 'axios';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    account: "0x75815E5604317DA2b42705659e5459a7a8E58aAa",
    receiver: "0x35E3c67B42f301DC2879893A4073fC1d0c97a3b1",
    entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
};

const ACCOUNT_ABI = [
    "function execute(address dest, uint256 value, bytes calldata func) external",
    "function validateUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp, bytes32 userOpHash, uint256 missingAccountFunds) external returns (uint256)"
];

const ENTRY_POINT_ABI = [
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)"
];

class DirectValidateTest {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(CONFIG.rpc);
        this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
        this.account = new ethers.Contract(CONFIG.account, ACCOUNT_ABI, this.wallet);
        this.entryPoint = new ethers.Contract(CONFIG.entryPoint, ENTRY_POINT_ABI, this.provider);
    }

    async createMinimalUserOp() {
        const nonce = await this.entryPoint.getNonce(CONFIG.account, 0);
        return {
            sender: CONFIG.account,
            nonce: nonce,
            initCode: "0x",
            callData: "0x",
            callGasLimit: 50000n,
            verificationGasLimit: 300000n,
            preVerificationGas: 50000n,
            maxFeePerGas: ethers.parseUnits("10", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
            paymasterAndData: "0x",
            signature: "0x"
        };
    }

    calculateUserOpHash(userOp) {
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
        return ethers.keccak256(packed);
    }

    async testSimpleECDSAFirst(userOp, userOpHash) {
        console.log("🔍 Testing simple ECDSA signature first...");
        
        // 创建简单ECDSA签名
        const simpleSignature = await this.wallet.signMessage(ethers.getBytes(userOpHash));
        userOp.signature = simpleSignature;
        
        console.log("Trying validateUserOp with simple ECDSA signature...");
        
        try {
            // 直接调用validateUserOp
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
            
            const result = await this.account.validateUserOp(userOpArray, userOpHash, 0n);
            console.log("✅ Simple ECDSA validation result:", result.toString());
            console.log("   (0 = success, 1 = failure)");
            
            if (result.toString() === "1") {
                console.log("❌ Simple ECDSA failed - account expects BLS format!");
                return false;
            } else {
                console.log("✅ Simple ECDSA works - account not properly configured for BLS!");
                return true;
            }
        } catch (error) {
            if (error.message.includes("AA signature invalid")) {
                console.log("❌ Simple ECDSA signature validation failed");
                return false;
            } else {
                console.log("❌ validateUserOp call failed:", error.message);
                return false;
            }
        }
    }

    async createBLSSignature(userOpHash) {
        console.log("🔧 Creating BLS+ECDSA signature...");
        
        const nodeIds = [
            "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
            "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
            "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
        ];
        
        // 获取BLS签名
        const signatures = [];
        for (let i = 0; i < 3; i++) {
            const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
                message: userOpHash
            });
            signatures.push(response.data.signature);
        }
        
        // 聚合
        const aggResponse = await axios.post(`http://localhost:3001/signature/aggregate`, {
            signatures: signatures
        });
        const aggregatedSignature = aggResponse.data.signature;
        
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
        
        // 创建AA签名
        const aaSignature = await this.wallet.signMessage(ethers.getBytes(userOpHash));
        
        // 打包
        const nodeIdsLength = ethers.solidityPacked(["uint256"], [nodeIds.length]);
        const nodeIdsBytes = ethers.solidityPacked(
            Array(nodeIds.length).fill("bytes32"),
            nodeIds
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
        
        return packedSignature;
    }

    async testBLSSignature(userOp, userOpHash) {
        console.log("\n🔍 Testing BLS+ECDSA signature...");
        
        const blsSignature = await this.createBLSSignature(userOpHash);
        userOp.signature = blsSignature;
        
        console.log("BLS signature length:", blsSignature.length / 2 - 1, "bytes");
        console.log("Trying validateUserOp with BLS signature...");
        
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
            
            const result = await this.account.validateUserOp(userOpArray, userOpHash, 0n);
            console.log("✅ BLS validation result:", result.toString());
            console.log("   (0 = success, 1 = failure)");
            
            if (result.toString() === "0") {
                console.log("🎉 BLS signature validation SUCCESS!");
                return true;
            } else {
                console.log("❌ BLS signature validation failed");
                return false;
            }
        } catch (error) {
            console.log("❌ BLS validateUserOp failed:", error.message);
            
            if (error.data) {
                console.log("Error data:", error.data);
            }
            return false;
        }
    }

    async run() {
        try {
            console.log("🎯 Direct validateUserOp Test");
            console.log("=" .repeat(40));
            console.log("Account:", CONFIG.account);
            
            const userOp = await this.createMinimalUserOp();
            const userOpHash = this.calculateUserOpHash(userOp);
            
            console.log("UserOp nonce:", userOp.nonce.toString());
            console.log("UserOp hash:", userOpHash);
            
            // Test 1: Simple ECDSA
            const ecdsaWorks = await this.testSimpleECDSAFirst(userOp, userOpHash);
            
            // Test 2: BLS if ECDSA failed (meaning account expects BLS)
            if (!ecdsaWorks) {
                const blsWorks = await this.testBLSSignature(userOp, userOpHash);
                
                if (blsWorks) {
                    console.log("\n🏆 BREAKTHROUGH!");
                    console.log("✅ BLS signature validation works when called directly!");
                    console.log("✅ The issue with simulateValidation must be gas-related or context-related");
                    console.log("✅ Our BLS aggregate signature system is fundamentally working!");
                } else {
                    console.log("\n❌ Even direct BLS validation failed");
                    console.log("Need to debug signature format or BLS implementation");
                }
            } else {
                console.log("\n⚠️  Account accepts simple ECDSA");
                console.log("This means useAAStarValidator might not be properly configured");
            }
            
        } catch (error) {
            console.error("❌ Test failed:", error.message);
        }
    }
}

const test = new DirectValidateTest();
test.run().catch(console.error);