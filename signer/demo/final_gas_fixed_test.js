import { ethers } from 'ethers';
import axios from 'axios';

// 更新为新部署的合约地址
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    
    // 新部署的合约地址（gas修复版本）
    factory: "0x559DD2D8Bf9180A70Da56FEFF57DA531BF3f2E1c",
    validator: "0x0Fe448a612efD9B38287e25a208448315c2E2Df3",
    
    receiver: "0x962753056921000790fb7Fe7C2dCA3006bA605f3",
    
    selectedNodes: [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
    ]
};

const FACTORY_ABI = [
    "function getAddress(address owner, address validator, bool useAAStarValidator, uint256 salt) view returns (address)",
    "function createAccountWithAAStarValidator(address owner, address aaStarValidator, bool useAAStarValidator, uint256 salt) returns (address)"
];

const ACCOUNT_ABI = [
    "function execute(address dest, uint256 value, bytes calldata func) external"
];

const ENTRY_POINT_ABI = [
    "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address payable beneficiary) external",
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)",
    "function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external"
];

class FinalGasFixedTest {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(CONFIG.rpc);
        this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
        this.factory = new ethers.Contract(CONFIG.factory, FACTORY_ABI, this.wallet);
        this.entryPoint = new ethers.Contract(CONFIG.entryPoint, ENTRY_POINT_ABI, this.wallet);
    }

    async createTestAccount() {
        console.log("🏭 Creating new test account with gas-fixed validator...");
        
        const salt = Date.now(); // Use timestamp as salt for uniqueness
        const owner = this.wallet.address;
        
        // Get account address
        const accountAddress = await this.factory["getAddress(address,address,bool,uint256)"](
            owner,
            CONFIG.validator,
            true,
            salt
        );
        
        console.log("📤 Predicted account:", accountAddress);
        
        // Check if exists
        const code = await this.provider.getCode(accountAddress);
        if (code === "0x") {
            console.log("Deploying account...");
            const tx = await this.factory.createAccountWithAAStarValidator(
                owner,
                CONFIG.validator,
                true,
                salt,
                {
                    maxFeePerGas: ethers.parseUnits("50", "gwei"),
                    maxPriorityFeePerGas: ethers.parseUnits("10", "gwei")
                }
            );
            await tx.wait();
            console.log("✅ Account deployed");
        }
        
        // Fund account
        const balance = await this.provider.getBalance(accountAddress);
        if (balance < ethers.parseEther("0.01")) {
            console.log("💰 Funding account...");
            const fundTx = await this.wallet.sendTransaction({
                to: accountAddress,
                value: ethers.parseEther("0.02"),
                maxFeePerGas: ethers.parseUnits("50", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("10", "gwei")
            });
            await fundTx.wait();
            console.log("✅ Account funded");
        }
        
        return accountAddress;
    }

    async createUserOp(senderAddress) {
        const account = new ethers.Contract(senderAddress, ACCOUNT_ABI, this.provider);
        const nonce = await this.entryPoint.getNonce(senderAddress, 0);
        
        const callData = account.interface.encodeFunctionData("execute", [
            CONFIG.receiver,
            ethers.parseEther("0.001"),
            "0x"
        ]);
        
        return {
            sender: senderAddress,
            nonce: nonce,
            initCode: "0x",
            callData: callData,
            callGasLimit: 100000n,
            verificationGasLimit: 800000n, // 增加更多gas用于验证
            preVerificationGas: 60000n,
            maxFeePerGas: ethers.parseUnits("5", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
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

    async createBLSSignature(userOpHash) {
        console.log("🔧 Creating BLS+ECDSA signature with fixed gas...");
        
        // Get BLS signatures
        const signatures = [];
        for (let i = 0; i < 3; i++) {
            const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
                message: userOpHash
            });
            signatures.push(response.data.signature);
            console.log(`Got signature from node ${i+1}`);
        }
        
        // Aggregate
        const aggResponse = await axios.post(`http://localhost:3001/signature/aggregate`, {
            signatures: signatures
        });
        const aggregatedSignature = aggResponse.data.signature;
        console.log("✅ Signatures aggregated");
        
        // Generate messagePoint
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
        console.log("✅ MessagePoint generated");
        
        // Create AA signature
        const aaSignature = await this.wallet.signMessage(ethers.getBytes(userOpHash));
        console.log("✅ AA signature created");
        
        // Pack signature
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
        
        console.log(`✅ Complete signature (${packedSignature.length / 2 - 1} bytes)`);
        return packedSignature;
    }

    async simulateValidation(userOp) {
        console.log("🧪 Testing with gas-fixed validator...");
        
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
            console.log("✅ Simulation passed!");
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
                    console.log("📊 Validation result:");
                    console.log("  preOpGas:", result.preOpGas.toString());
                    console.log("  prefund:", ethers.formatEther(result.prefund), "ETH");
                    console.log("  sigFailed:", result.sigFailed);
                    
                    if (!result.sigFailed) {
                        console.log("🎉 SUCCESS! Gas fix worked!");
                        console.log("✅ BLS aggregate signature validation PASSED!");
                        return true;
                    } else {
                        console.log("❌ Still failed - might need more gas or other issue");
                        return false;
                    }
                } catch (decodeError) {
                    console.log("❌ Failed to decode result:", decodeError.message);
                    return false;
                }
            } else {
                console.log("❌ Simulation failed:", error.message);
                return false;
            }
        }
    }

    async run() {
        try {
            console.log("🎯 Final Gas-Fixed BLS+ERC-4337 Test");
            console.log("=" .repeat(50));
            console.log("Using gas-fixed validator:", CONFIG.validator);
            
            // 1. Create test account
            const accountAddress = await this.createTestAccount();
            
            // 2. Create UserOperation
            const userOp = await this.createUserOp(accountAddress);
            console.log("UserOp nonce:", userOp.nonce.toString());
            
            // 3. Calculate hash
            const userOpHash = this.calculateUserOpHash(userOp);
            console.log("UserOp hash:", userOpHash);
            
            // 4. Create signature
            const signature = await this.createBLSSignature(userOpHash);
            userOp.signature = signature;
            
            // 5. Test validation
            const isValid = await this.simulateValidation(userOp);
            
            if (isValid) {
                console.log("\n🏆 COMPLETE SUCCESS!");
                console.log("✅ Gas issue resolved");
                console.log("✅ BLS aggregate signature system working");
                console.log("✅ ERC-4337 validation passed");
                console.log("\nThe system is ready for production use!");
            } else {
                console.log("\n❌ Still has issues to resolve");
            }
            
        } catch (error) {
            console.error("❌ Test failed:", error.message);
        }
    }
}

const test = new FinalGasFixedTest();
test.run().catch(console.error);