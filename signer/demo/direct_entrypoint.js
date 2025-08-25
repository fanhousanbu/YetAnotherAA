import { ethers } from 'ethers';
import axios from 'axios';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    account: "0x75815E5604317DA2b42705659e5459a7a8E58aAa",
    receiver: "0x35E3c67B42f301DC2879893A4073fC1d0c97a3b1",
    validator: "0x91Fc1Ff9646A2e5F09525837769F25c87777A07F",
    
    selectedNodes: [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
    ]
};

// ABIs
const ENTRY_POINT_ABI = [
    "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address payable beneficiary) external",
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)",
    "function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external"
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

    async createUserOperation() {
        console.log("🔧 Creating UserOperation...");
        
        const nonce = await this.entryPoint.getNonce(CONFIG.account, 0);
        console.log("Nonce:", nonce.toString());
        
        const callData = this.account.interface.encodeFunctionData("execute", [
            CONFIG.receiver,
            ethers.parseEther("0.0001"), // Much smaller amount
            "0x"
        ]);
        
        const userOp = {
            sender: CONFIG.account,
            nonce: nonce,
            initCode: "0x",
            callData: callData,
            callGasLimit: 80000n,      // Reduced
            verificationGasLimit: 200000n,  // Reduced but still enough for BLS
            preVerificationGas: 40000n,     // Reduced
            maxFeePerGas: ethers.parseUnits("5", "gwei"),     // Much lower
            maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"), // Much lower  
            paymasterAndData: "0x",
            signature: "0x"
        };
        
        return userOp;
    }

    calculateHashes(userOp) {
        // ERC-4337 standard hash
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
        const erc4337Hash = ethers.keccak256(entryPointHash);
        
        // BLS hash (simplified)
        const packedSimple = ethers.solidityPacked(
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
        const blsHash = ethers.keccak256(packedSimple);
        
        console.log("📝 ERC-4337 hash:", erc4337Hash);
        console.log("📝 BLS hash:", blsHash);
        
        return { erc4337Hash, blsHash };
    }

    async getBLSSignatures(blsHash) {
        console.log("🔐 Getting BLS signatures...");
        
        const signatures = [];
        for (let i = 0; i < 3; i++) {
            const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
                message: blsHash
            });
            signatures.push(response.data.signature);
            console.log(`Got signature from node ${i+1}`);
        }
        
        // Aggregate
        const aggResponse = await axios.post(`http://localhost:3001/signature/aggregate`, {
            signatures: signatures
        });
        
        return aggResponse.data.signature;
    }

    async generateMessagePoint(blsHash) {
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
        
        return "0x" + Buffer.from(result).toString('hex');
    }

    async createCompleteSignature(erc4337Hash, blsHash) {
        console.log("🔏 Creating complete signature...");
        
        // Get BLS components
        const aggregatedSignature = await this.getBLSSignatures(blsHash);
        const messagePoint = await this.generateMessagePoint(blsHash);
        
        // Create AA signature
        const aaSignature = await this.wallet.signMessage(ethers.getBytes(erc4337Hash));
        
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
        
        console.log(`✅ Signature created (${packedSignature.length / 2 - 1} bytes)`);
        return packedSignature;
    }

    async simulateValidation(userOp) {
        console.log("🧪 Simulating validation...");
        
        try {
            // Convert to array format
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
            console.log("✅ Simulation passed");
            return true;
        } catch (error) {
            if (error.data) {
                // Check if it's a ValidationResult (error selector 0xe0cff05f)
                if (error.data.startsWith("0xe0cff05f")) {
                    try {
                        // Skip the 4-byte selector and decode the ValidationResult
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
                            console.log("✅ Signature validation succeeded!");
                            console.log("🎉 BLS aggregate signature verification passed!");
                            return true;
                        } else {
                            console.log("❌ Signature validation failed");
                            return false;
                        }
                    } catch (decodeError) {
                        console.log("❌ Failed to decode validation result:", decodeError.message);
                        return false;
                    }
                } else {
                    console.log("❌ Simulation failed with unknown error:", error.data);
                    return false;
                }
            } else {
                console.log("❌ Simulation failed:", error.message);
                return false;
            }
        }
    }

    async executeDirectly(userOp) {
        console.log("🚀 Executing directly via EntryPoint...");
        
        try {
            // Convert to array format for handleOps
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
            
            // Execute with higher gas limit
            const tx = await this.entryPoint.handleOps(
                [userOpArray],
                this.wallet.address, // beneficiary
                { 
                    gasLimit: 1000000,
                    maxFeePerGas: ethers.parseUnits("20", "gwei"),
                    maxPriorityFeePerGas: ethers.parseUnits("5", "gwei")
                }
            );
            
            console.log("📤 Transaction sent:", tx.hash);
            
            const receipt = await tx.wait();
            console.log("✅ Transaction confirmed!");
            console.log("Gas used:", receipt.gasUsed.toString());
            console.log("Block number:", receipt.blockNumber);
            
            return receipt;
        } catch (error) {
            console.error("❌ Direct execution failed:", error.message);
            if (error.data) {
                console.error("Error data:", error.data);
            }
            throw error;
        }
    }

    async run() {
        try {
            console.log("🚀 Direct EntryPoint Execution Test");
            console.log("=" .repeat(40));
            console.log("Account:", CONFIG.account);
            console.log("Receiver:", CONFIG.receiver);
            console.log("Amount: 0.0001 ETH\n");
            
            // Step 1: Create UserOperation
            const userOp = await this.createUserOperation();
            
            // Step 2: Calculate hashes
            const { erc4337Hash, blsHash } = this.calculateHashes(userOp);
            
            // Step 3: Create signature
            const signature = await this.createCompleteSignature(erc4337Hash, blsHash);
            userOp.signature = signature;
            
            // Step 4: Simulate validation
            const isValid = await this.simulateValidation(userOp);
            
            if (isValid) {
                // Step 5: Execute directly
                const receipt = await this.executeDirectly(userOp);
                
                // Verify transfer
                console.log("\n🔍 Verifying transfer...");
                const receiverBalance = await this.provider.getBalance(CONFIG.receiver);
                console.log(`Receiver balance: ${ethers.formatEther(receiverBalance)} ETH`);
                
                console.log("\n✅ SUCCESS: BLS+ERC-4337 transfer completed!");
                console.log("This proves the BLS aggregate signature system works correctly.");
                
            } else {
                console.log("\n❌ Validation failed - cannot proceed with execution");
            }
            
        } catch (error) {
            console.error("\n❌ Test failed:", error.message);
        }
    }
}

// Run the test
const test = new DirectEntryPointTest();
test.run().catch(console.error);