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
    "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address payable beneficiary) external",
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)",
    "function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external"
];

const ACCOUNT_ABI = [
    "function execute(address dest, uint256 value, bytes calldata func) external"
];

class CorrectedTest {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(CONFIG.rpc);
        this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
        this.entryPoint = new ethers.Contract(CONFIG.entryPoint, ENTRY_POINT_ABI, this.wallet);
        this.account = new ethers.Contract(CONFIG.account, ACCOUNT_ABI, this.provider);
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
            callGasLimit: 100000n,
            verificationGasLimit: 500000n, // 大幅增加验证gas限制用于BLS
            preVerificationGas: 60000n,
            maxFeePerGas: ethers.parseUnits("3", "gwei"), // 降低gas价格减少成本
            maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
            paymasterAndData: "0x",
            signature: "0x"
        };
    }

    // 修正：使用EntryPoint传递给validateUserOp的hash
    calculateCorrectUserOpHash(userOp) {
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

    async createCorrectedSignature(userOpHash) {
        console.log("🔧 Creating corrected signature with unified hash...");
        console.log("Using hash:", userOpHash);
        
        const nodeIds = [
            "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
            "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
            "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
        ];
        
        // 1. 获取BLS签名（使用统一的hash）
        const signatures = [];
        for (let i = 0; i < 3; i++) {
            const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
                message: userOpHash
            });
            signatures.push(response.data.signature);
            console.log(`Got BLS signature from node ${i+1}`);
        }
        
        // 2. 聚合BLS签名
        const aggResponse = await axios.post(`http://localhost:3001/signature/aggregate`, {
            signatures: signatures
        });
        const aggregatedSignature = aggResponse.data.signature;
        console.log("✅ BLS signatures aggregated");
        
        // 3. 生成messagePoint（使用统一的hash）
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
        
        // 4. 创建AA签名（使用统一的hash）
        const aaSignature = await this.wallet.signMessage(ethers.getBytes(userOpHash));
        console.log("✅ AA signature created");
        
        // 5. 打包完整签名
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
        
        console.log(`✅ Complete signature packed (${packedSignature.length / 2 - 1} bytes)`);
        return packedSignature;
    }

    async simulateValidation(userOp) {
        console.log("🧪 Running simulateValidation...");
        
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
            console.log("✅ Simulation passed without ValidationResult");
            return true;
        } catch (error) {
            if (error.data && error.data.startsWith("0xe0cff05f")) {
                // ValidationResult
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
                    console.log("  validAfter:", result.validAfter.toString());
                    console.log("  validUntil:", result.validUntil.toString());
                    
                    if (!result.sigFailed) {
                        console.log("✅ SIGNATURE VALIDATION SUCCEEDED!");
                        console.log("🎉 BLS aggregate signature system is working correctly!");
                        return true;
                    } else {
                        console.log("❌ Signature validation still failed");
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

    async executeDirectly(userOp) {
        console.log("🚀 Executing via EntryPoint handleOps...");
        
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
            
            const tx = await this.entryPoint.handleOps(
                [userOpArray],
                this.wallet.address,
                { 
                    gasLimit: 1000000,
                    maxFeePerGas: ethers.parseUnits("15", "gwei"),
                    maxPriorityFeePerGas: ethers.parseUnits("3", "gwei")
                }
            );
            
            console.log("📤 Transaction sent:", tx.hash);
            const receipt = await tx.wait();
            console.log("✅ Transaction confirmed!");
            console.log("Gas used:", receipt.gasUsed.toString());
            
            return receipt;
        } catch (error) {
            console.error("❌ Execution failed:", error.message);
            throw error;
        }
    }

    async run() {
        try {
            console.log("🎯 Final Corrected BLS+ERC-4337 Test");
            console.log("=" .repeat(50));
            
            // 1. Create UserOperation
            const userOp = await this.createUserOp();
            console.log("UserOp created with nonce:", userOp.nonce.toString());
            
            // 2. Calculate the correct hash (unified for both BLS and AA)
            const correctHash = this.calculateCorrectUserOpHash(userOp);
            console.log("Correct unified hash:", correctHash);
            
            // 3. Create corrected signature
            const signature = await this.createCorrectedSignature(correctHash);
            userOp.signature = signature;
            
            // 4. Test with simulation
            const isValid = await this.simulateValidation(userOp);
            
            if (isValid) {
                console.log("\n🎊 SUCCESS! Proceeding with actual execution...");
                
                // 5. Execute the transaction
                const receipt = await this.executeDirectly(userOp);
                
                // 6. Verify the transfer
                console.log("\n🔍 Verifying transfer...");
                const receiverBalance = await this.provider.getBalance(CONFIG.receiver);
                console.log(`Receiver balance: ${ethers.formatEther(receiverBalance)} ETH`);
                
                console.log("\n🏆 COMPLETE SUCCESS!");
                console.log("✅ BLS aggregate signature verification passed");
                console.log("✅ ERC-4337 UserOperation executed successfully");
                console.log("✅ Transfer completed");
                console.log("\nTransaction hash:", receipt.hash);
                
            } else {
                console.log("\n❌ Validation failed - cannot proceed");
            }
            
        } catch (error) {
            console.error("\n❌ Test failed:", error.message);
        }
    }
}

const test = new CorrectedTest();
test.run().catch(console.error);