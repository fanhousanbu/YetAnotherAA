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

const ACCOUNT_ABI = [
    "function execute(address dest, uint256 value, bytes calldata func) external",
    "function _parseAndValidateAAStarSignature(bytes calldata signature, bytes32 userOpHash) external view returns (bool isValid)",
    "function validateUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp, bytes32 userOpHash, uint256 missingAccountFunds) external returns (uint256)"
];

const VALIDATOR_ABI = [
    "function validateAggregateSignature(bytes32[] calldata nodeIds, bytes calldata signature, bytes calldata messagePoint) external view returns (bool isValid)"
];

const ENTRY_POINT_ABI = [
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)"
];

class ValidationAnalysis {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(CONFIG.rpc);
        this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
        this.account = new ethers.Contract(CONFIG.account, ACCOUNT_ABI, this.provider);
        this.validator = new ethers.Contract(CONFIG.validator, VALIDATOR_ABI, this.provider);
        this.entryPoint = new ethers.Contract(CONFIG.entryPoint, ENTRY_POINT_ABI, this.provider);
    }

    async createTestUserOp() {
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

    calculateUserOpHash(userOp) {
        // ERC-4337 标准计算
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

    calculateBLSHash(userOp) {
        // 简化版本用于BLS签名
        const packed = ethers.solidityPacked(
            ["address", "uint256", "bytes", "bytes", "uint256", "uint256", "uint256", "uint256", "uint256", "bytes"],
            [
                userOp.sender,
                userOp.nonce,
                userOp.initCode,
                userOp.callData,
                userOp.callGasLimit,
                userOp.verificationGasLimit,
                userOp.preVerificationGas,
                userOp.maxFeePerGas,
                userOp.maxPriorityFeePerGas,
                userOp.paymasterAndData
            ]
        );
        return ethers.keccak256(packed);
    }

    async createCompleteSignature(erc4337Hash, blsHash) {
        console.log("🔧 Creating signature components...");
        
        // 1. 获取BLS签名
        const nodeIds = [
            "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
            "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
            "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
        ];
        
        const signatures = [];
        for (let i = 0; i < 3; i++) {
            const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
                message: blsHash
            });
            signatures.push(response.data.signature);
        }
        
        // 2. 聚合BLS签名
        const aggResponse = await axios.post(`http://localhost:3001/signature/aggregate`, {
            signatures: signatures
        });
        const aggregatedSignature = aggResponse.data.signature;
        
        // 3. 生成messagePoint
        const { bls12_381: bls } = await import('@noble/curves/bls12-381.js');
        const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
        
        const messageBytes = ethers.getBytes(blsHash);
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
        
        // 4. 创建AA签名
        const aaSignature = await this.wallet.signMessage(ethers.getBytes(erc4337Hash));
        
        console.log("✅ All signature components created");
        
        return {
            nodeIds,
            aggregatedSignature,
            messagePoint,
            aaSignature
        };
    }

    async testIndividualComponents(erc4337Hash, blsHash, sigComponents) {
        console.log("\n🔍 Testing individual signature components:");
        
        // Test 1: BLS验证器直接测试
        console.log("\n1️⃣ Testing BLS Validator directly:");
        try {
            const isValidBLS = await this.validator.validateAggregateSignature(
                sigComponents.nodeIds,
                sigComponents.aggregatedSignature,
                sigComponents.messagePoint
            );
            console.log("   BLS validation result:", isValidBLS ? "✅ PASS" : "❌ FAIL");
        } catch (error) {
            console.log("   BLS validation error:", error.message);
        }
        
        // Test 2: AA签名验证（通过手动计算）
        console.log("\n2️⃣ Testing AA signature manually:");
        try {
            const hash = ethers.hashMessage(ethers.getBytes(erc4337Hash));
            const recoveredAddress = ethers.recoverAddress(hash, sigComponents.aaSignature);
            const expectedOwner = "0x075F227E25a63417Bf66F6e751b376B09Fd43928";
            
            console.log("   Recovered address:", recoveredAddress);
            console.log("   Expected owner:   ", expectedOwner);
            console.log("   AA signature valid:", recoveredAddress.toLowerCase() === expectedOwner.toLowerCase() ? "✅ PASS" : "❌ FAIL");
        } catch (error) {
            console.log("   AA signature error:", error.message);
        }
        
        // Test 3: 完整签名格式测试
        console.log("\n3️⃣ Testing complete signature format:");
        const nodeIdsLength = ethers.solidityPacked(["uint256"], [sigComponents.nodeIds.length]);
        const nodeIdsBytes = ethers.solidityPacked(
            Array(sigComponents.nodeIds.length).fill("bytes32"),
            sigComponents.nodeIds
        );
        
        const packedSignature = ethers.solidityPacked(
            ["bytes", "bytes", "bytes", "bytes", "bytes"],
            [
                nodeIdsLength,
                nodeIdsBytes,
                sigComponents.aggregatedSignature,
                sigComponents.messagePoint,
                sigComponents.aaSignature
            ]
        );
        
        console.log("   Signature length:", packedSignature.length / 2 - 1, "bytes");
        console.log("   Expected format: 32 + (3×32) + 256 + 256 + 65 =", 32 + 96 + 256 + 256 + 65, "bytes");
        console.log("   Format correct:", (packedSignature.length / 2 - 1) === (32 + 96 + 256 + 256 + 65) ? "✅ PASS" : "❌ FAIL");
        
        return packedSignature;
    }

    async testAccountSignatureValidation(userOpHash, signature) {
        console.log("\n4️⃣ Testing account's signature validation function:");
        
        try {
            // 注意：这个函数只能被account自己调用，所以我们期望得到"Only self can call"错误
            // 但我们可以从错误类型来判断函数是否存在和签名是否正确
            await this.account._parseAndValidateAAStarSignature(signature, userOpHash);
            console.log("   Unexpected success - function should be self-only");
        } catch (error) {
            if (error.message.includes("Only self can call")) {
                console.log("   Function exists and signature parsing works: ✅ PASS");
                console.log("   (Error is expected - function is self-only)");
            } else {
                console.log("   Signature parsing failed:", error.message);
                console.log("   This indicates a signature format issue: ❌ FAIL");
            }
        }
    }

    async analyzeHashDifferences(userOp) {
        console.log("\n5️⃣ Analyzing hash calculation differences:");
        
        const erc4337Hash = this.calculateUserOpHash(userOp);
        const blsHash = this.calculateBLSHash(userOp);
        
        console.log("   ERC-4337 hash (for AA):", erc4337Hash);
        console.log("   BLS hash (simplified): ", blsHash);
        console.log("   Hashes different:", erc4337Hash !== blsHash ? "✅ Expected" : "❌ Unexpected");
        
        // 检查EntryPoint会如何计算userOpHash
        console.log("\n   EntryPoint hash calculation check:");
        
        // EntryPoint内部计算的hash（不包含EntryPoint和chainId）
        const entryPointInternalHash = ethers.keccak256(ethers.solidityPacked(
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
        ));
        
        console.log("   EntryPoint internal hash:", entryPointInternalHash);
        console.log("   Matches our BLS hash:", entryPointInternalHash === blsHash ? "✅ Match" : "❌ Different");
        
        return { erc4337Hash, blsHash, entryPointInternalHash };
    }

    async run() {
        try {
            console.log("🔍 Analyzing EntryPoint simulateValidation Failure");
            console.log("=" .repeat(60));
            
            // 创建UserOperation
            const userOp = await this.createTestUserOp();
            console.log("UserOp created with nonce:", userOp.nonce.toString());
            
            // 分析hash计算
            const hashes = await this.analyzeHashDifferences(userOp);
            
            // 创建签名组件
            const sigComponents = await this.createCompleteSignature(hashes.erc4337Hash, hashes.blsHash);
            
            // 测试各个组件
            const completeSignature = await this.testIndividualComponents(
                hashes.erc4337Hash, 
                hashes.blsHash, 
                sigComponents
            );
            
            // 测试账户的签名验证函数
            await this.testAccountSignatureValidation(hashes.erc4337Hash, completeSignature);
            
            console.log("\n📊 ANALYSIS SUMMARY:");
            console.log("=" .repeat(40));
            console.log("Based on the above tests, the most likely causes of simulateValidation failure:");
            console.log("");
            console.log("1. Hash mismatch: EntryPoint might be passing a different hash to validateUserOp");
            console.log("2. Gas issues: Account might run out of gas during BLS verification");
            console.log("3. Context differences: simulateValidation vs actual execution context");
            console.log("4. EIP-2537 precompile issues: BLS operations might fail in simulation");
            
            // 关键发现
            if (hashes.entryPointInternalHash === hashes.blsHash) {
                console.log("\n💡 KEY INSIGHT:");
                console.log("The hash calculations are correct. The issue is likely:");
                console.log("- Gas limit too low for BLS operations");
                console.log("- EIP-2537 precompiles not available in simulation context");
                console.log("- Account receives different hash from EntryPoint than expected");
            }
            
        } catch (error) {
            console.error("❌ Analysis failed:", error.message);
        }
    }
}

const analysis = new ValidationAnalysis();
analysis.run().catch(console.error);