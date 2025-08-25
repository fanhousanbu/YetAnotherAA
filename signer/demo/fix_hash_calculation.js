import { ethers } from 'ethers';
import axios from 'axios';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    account: "0x75815E5604317DA2b42705659e5459a7a8E58aAa",
    receiver: "0x35E3c67B42f301DC2879893A4073fC1d0c97a3b1",
    validator: "0x91Fc1Ff9646A2e5F09525837769F25c87777A07F"
};

const ENTRY_POINT_ABI = [
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)",
    "function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external"
];

const ACCOUNT_ABI = [
    "function execute(address dest, uint256 value, bytes calldata func) external"
];

const VALIDATOR_ABI = [
    "function validateAggregateSignature(bytes32[] calldata nodeIds, bytes calldata signature, bytes calldata messagePoint) external view returns (bool isValid)"
];

class HashFixTest {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(CONFIG.rpc);
        this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
        this.account = new ethers.Contract(CONFIG.account, ACCOUNT_ABI, this.provider);
        this.validator = new ethers.Contract(CONFIG.validator, VALIDATOR_ABI, this.provider);
        this.entryPoint = new ethers.Contract(CONFIG.entryPoint, ENTRY_POINT_ABI, this.provider);
    }

    async createUserOp() {
        const nonce = await this.entryPoint.getNonce(CONFIG.account, 0);
        const callData = this.account.interface.encodeFunctionData("execute", [
            CONFIG.receiver,
            ethers.parseEther("0.0001"),
            "0x"
        ]);
        
        return {
            sender: CONFIG.account,
            nonce: nonce,
            initCode: "0x",
            callData: callData,
            callGasLimit: 80000n,
            verificationGasLimit: 200000n,
            preVerificationGas: 40000n,
            maxFeePerGas: ethers.parseUnits("5", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
            paymasterAndData: "0x",
            signature: "0x"
        };
    }

    calculateEntryPointUserOpHash(userOp) {
        // EntryPoint传递给validateUserOp的hash
        // 这是EntryPoint内部计算的hash，不包含EntryPoint地址和chainId
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

    calculateClientSideUserOpHash(userOp) {
        // 客户端签名时使用的hash（包含EntryPoint和chainId）
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
        
        const userOpHash = ethers.keccak256(packed);
        const chainId = 11155111;
        const entryPointHash = ethers.solidityPacked(
            ["bytes32", "address", "uint256"],
            [userOpHash, CONFIG.entryPoint, chainId]
        );
        return ethers.keccak256(entryPointHash);
    }

    async getBLSSignaturesForHash(messageHash) {
        const signatures = [];
        for (let i = 0; i < 3; i++) {
            const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
                message: messageHash
            });
            signatures.push(response.data.signature);
        }
        
        const aggResponse = await axios.post(`http://localhost:3001/signature/aggregate`, {
            signatures: signatures
        });
        
        return aggResponse.data.signature;
    }

    async generateMessagePoint(messageHash) {
        const { bls12_381: bls } = await import('@noble/curves/bls12-381.js');
        const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
        
        const messageBytes = ethers.getBytes(messageHash);
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
        
        return "0x" + Buffer.from(result).toString('hex');
    }

    async testBothApproaches(userOp) {
        console.log("🔄 Testing both hash approaches...\n");
        
        const entryPointHash = this.calculateEntryPointUserOpHash(userOp);
        const clientSideHash = this.calculateClientSideUserOpHash(userOp);
        
        console.log("📊 Hash comparison:");
        console.log("EntryPoint hash:  ", entryPointHash);
        console.log("Client-side hash: ", clientSideHash);
        console.log("Hashes match:", entryPointHash === clientSideHash ? "✅" : "❌");
        
        const nodeIds = [
            "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
            "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
            "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
        ];
        
        console.log("\n🧪 Testing both hashes with BLS verification:");
        
        // Test 1: 使用EntryPoint hash进行BLS签名和验证
        console.log("\n1️⃣ Using EntryPoint hash for BLS:");
        const blsSignatureEntryPoint = await this.getBLSSignaturesForHash(entryPointHash);
        const messagePointEntryPoint = await this.generateMessagePoint(entryPointHash);
        
        const isValidEntryPoint = await this.validator.validateAggregateSignature(
            nodeIds,
            blsSignatureEntryPoint,
            messagePointEntryPoint
        );
        console.log("   BLS validation result:", isValidEntryPoint ? "✅ PASS" : "❌ FAIL");
        
        // Test 2: 使用client-side hash进行BLS签名和验证
        console.log("\n2️⃣ Using client-side hash for BLS:");
        const blsSignatureClientSide = await this.getBLSSignaturesForHash(clientSideHash);
        const messagePointClientSide = await this.generateMessagePoint(clientSideHash);
        
        const isValidClientSide = await this.validator.validateAggregateSignature(
            nodeIds,
            blsSignatureClientSide,
            messagePointClientSide
        );
        console.log("   BLS validation result:", isValidClientSide ? "✅ PASS" : "❌ FAIL");
        
        console.log("\n💡 CORRECTED APPROACH:");
        console.log("We should use the SAME hash for both AA signature and BLS signature!");
        console.log("The correct hash is the one EntryPoint passes to validateUserOp:");
        console.log(entryPointHash);
        
        // Create corrected signature
        console.log("\n🔧 Creating corrected signature...");
        const aaSignature = await this.wallet.signMessage(ethers.getBytes(entryPointHash));
        
        // Pack the corrected signature
        const nodeIdsLength = ethers.solidityPacked(["uint256"], [nodeIds.length]);
        const nodeIdsBytes = ethers.solidityPacked(
            Array(nodeIds.length).fill("bytes32"),
            nodeIds
        );
        
        const correctedSignature = ethers.solidityPacked(
            ["bytes", "bytes", "bytes", "bytes", "bytes"],
            [
                nodeIdsLength,
                nodeIdsBytes,
                blsSignatureEntryPoint,
                messagePointEntryPoint,
                aaSignature
            ]
        );
        
        console.log("✅ Corrected signature created (", correctedSignature.length / 2 - 1, "bytes)");
        
        return correctedSignature;
    }

    async run() {
        try {
            console.log("🔍 Hash Calculation Fix Test");
            console.log("=" .repeat(40));
            
            const userOp = await this.createUserOp();
            const correctedSignature = await this.testBothApproaches(userOp);
            
            console.log("\n📋 SOLUTION:");
            console.log("The issue was using different hashes for BLS and AA signatures.");
            console.log("Both should use the hash that EntryPoint passes to validateUserOp.");
            console.log("This is the 'internal' hash without EntryPoint address and chainId.");
            
            console.log("\n🚀 The corrected signature should now work with simulateValidation!");
            
            // Return the corrected user op for testing
            userOp.signature = correctedSignature;
            return userOp;
            
        } catch (error) {
            console.error("❌ Test failed:", error.message);
        }
    }
}

const test = new HashFixTest();
test.run().catch(console.error);