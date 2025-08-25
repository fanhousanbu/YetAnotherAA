#!/usr/bin/env node
/**
 * ERC-4337 + BLS Transfer Tool
 * Complete ERC-4337 account abstraction transfer tool with integrated BLS aggregate signature functionality
 */

import { ethers } from 'ethers';
import { bls12_381 } from '@noble/curves/bls12-381.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    factory: "0x559DD2D8Bf9180A70Da56FEFF57DA531BF3f2E1c",
    validator: "0xAe7eA28a0aeA05cbB8631bDd7B10Cb0f387FC479",
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
    "function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external",
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)",
    "function getUserOpHash((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external view returns (bytes32)",
    "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address payable beneficiary) external"
];

const VALIDATOR_ABI = [
    "function getGasEstimate(uint256 nodeCount) external pure returns (uint256 gasEstimate)"
];

// ============================================================================
// BLS Signature Generation Functions
// ============================================================================

// EIP-2537 format encoding (G2 point, 256 bytes)
function encodeG2Point(point) {
    const result = new Uint8Array(256);
    const affine = point.toAffine();
    
    const x0Bytes = hexToBytes(affine.x.c0.toString(16).padStart(96, '0'));
    const x1Bytes = hexToBytes(affine.x.c1.toString(16).padStart(96, '0'));
    const y0Bytes = hexToBytes(affine.y.c0.toString(16).padStart(96, '0'));
    const y1Bytes = hexToBytes(affine.y.c1.toString(16).padStart(96, '0'));
    
    result.set(x0Bytes, 16);
    result.set(x1Bytes, 80);
    result.set(y0Bytes, 144);
    result.set(y1Bytes, 208);
    return result;
}

// Convert hexadecimal string to byte array
function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}

// Generate BLS signature parameters
async function generateBLSSignature(userOpHash, nodeIndices = [1, 2, 3]) {
    // Read configuration file
    const contractConfig = JSON.parse(readFileSync(join(__dirname, 'config.json'), 'utf8'));
    
    // Validate node indices
    const indices = nodeIndices.map(n => n - 1);
    for (const index of indices) {
        if (index < 0 || index >= contractConfig.keyPairs.length) {
            throw new Error(`Node index ${index + 1} is out of range (1-${contractConfig.keyPairs.length})`);
        }
    }
    
    // Get selected nodes
    const selectedNodes = indices.map(i => contractConfig.keyPairs[i]);
    
    // BLS signature parameters
    const messageBytes = ethers.getBytes(userOpHash);
    const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
    const bls = bls12_381;
    const sigs = bls.longSignatures;
    
    // Generate G2 point message
    const messagePoint = await bls.G2.hashToCurve(messageBytes, { DST });
    
    // Generate signature for each node
    const signatures = [];
    const publicKeys = [];
    const nodeIds = [];
    
    for (const node of selectedNodes) {
        const privateKeyBytes = hexToBytes(node.privateKey.substring(2));
        const publicKey = sigs.getPublicKey(privateKeyBytes);
        const signature = await sigs.sign(messagePoint, privateKeyBytes);
        
        signatures.push(signature);
        publicKeys.push(publicKey);
        nodeIds.push(node.contractNodeId);
    }
    
    // Aggregate signatures
    const aggregatedSignature = sigs.aggregateSignatures(signatures);
    const aggregatedPubKey = sigs.aggregatePublicKeys(publicKeys);
    
    // Verify aggregate signature
    const isValid = await sigs.verify(aggregatedSignature, messagePoint, aggregatedPubKey);
    if (!isValid) {
        throw new Error('Aggregate signature verification failed');
    }
    
    // Convert to contract format
    const aggregatedSignatureEIP = encodeG2Point(bls.G2.Point.fromHex(aggregatedSignature.toBytes()));
    const messageG2EIP = encodeG2Point(messagePoint);
    
    // Generate AA signature
    const aaAccount = contractConfig.aaAccount;
    const wallet = new ethers.Wallet(aaAccount.privateKey);
    const aaSignature = await wallet.signMessage(ethers.getBytes(userOpHash));
    
    return {
        nodeIds: nodeIds,
        signature: "0x" + Buffer.from(aggregatedSignatureEIP).toString('hex'),
        messagePoint: "0x" + Buffer.from(messageG2EIP).toString('hex'),
        aaAddress: aaAccount.address,
        aaSignature: aaSignature
    };
}

// ============================================================================
// ERC-4337 Transfer Execution Functions
// ============================================================================

class ERC4337Transfer {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(CONFIG.rpc);
        this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
        this.factory = new ethers.Contract(CONFIG.factory, FACTORY_ABI, this.wallet);
        this.entryPoint = new ethers.Contract(CONFIG.entryPoint, ENTRY_POINT_ABI, this.wallet);
        this.validator = new ethers.Contract(CONFIG.validator, VALIDATOR_ABI, this.provider);
    }

    async createOrGetAccount() {
        console.log("🏭 Creating or getting account...");
        
        const salt = 12345;
        const owner = this.wallet.address;
        
        const accountAddress = await this.factory["getAddress(address,address,bool,uint256)"](
            owner,
            CONFIG.validator,
            true,
            salt
        );
        
        console.log("Account address:", accountAddress);
        
        // Check if already exists
        const code = await this.provider.getCode(accountAddress);
        if (code === "0x") {
            console.log("Deploying new account...");
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
            console.log("✅ Account deployed successfully");
        }
        
        // Check balance and fund if needed
        const balance = await this.provider.getBalance(accountAddress);
        if (balance < ethers.parseEther("0.05")) {
            console.log("Funding account...");
            const fundTx = await this.wallet.sendTransaction({
                to: accountAddress,
                value: ethers.parseEther("0.1"),
                maxFeePerGas: ethers.parseUnits("50", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("10", "gwei")
            });
            await fundTx.wait();
            console.log("✅ Account funded successfully");
        }
        
        return accountAddress;
    }

    async performTransfer(accountAddress) {
        console.log("\n🚀 Executing BLS+ERC-4337 transfer...");
        
        // Show gas estimation
        const gasEstimate = await this.validator.getGasEstimate(CONFIG.selectedNodes.length);
        console.log(`Dynamic gas estimate (${CONFIG.selectedNodes.length} nodes):`, Number(gasEstimate).toLocaleString());
        
        const account = new ethers.Contract(accountAddress, ACCOUNT_ABI, this.provider);
        const nonce = await this.entryPoint.getNonce(accountAddress, 0);
        
        const callData = account.interface.encodeFunctionData("execute", [
            CONFIG.receiver,
            ethers.parseEther("0.002"), // Transfer 0.002 ETH
            "0x"
        ]);
        
        const userOp = {
            sender: accountAddress,
            nonce: nonce,
            initCode: "0x",
            callData: callData,
            callGasLimit: 150000n,
            verificationGasLimit: 1000000n,
            preVerificationGas: 60000n,
            maxFeePerGas: ethers.parseUnits("30", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("10", "gwei"),
            paymasterAndData: "0x",
            signature: "0x"
        };
        
        // Get userOpHash
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
        
        const userOpHash = await this.entryPoint.getUserOpHash(userOpArray);
        console.log("UserOp hash:", userOpHash);
        
        // Generate BLS signature
        console.log("Generating BLS aggregate signature...");
        const blsData = await generateBLSSignature(userOpHash, [1, 2, 3]);
        
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
                blsData.signature,
                blsData.messagePoint,
                blsData.aaSignature
            ]
        );
        
        userOp.signature = packedSignature;
        
        // Execute transfer
        const receiverBalanceBefore = await this.provider.getBalance(CONFIG.receiver);
        console.log("Receiver balance before:", ethers.formatEther(receiverBalanceBefore), "ETH");
        
        const finalUserOpArray = [
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
            [finalUserOpArray],
            this.wallet.address,
            {
                gasLimit: 2000000,
                maxFeePerGas: ethers.parseUnits("50", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("10", "gwei")
            }
        );
        
        console.log("Transaction hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("Gas used:", receipt.gasUsed.toString());
        
        // Check results
        const receiverBalanceAfter = await this.provider.getBalance(CONFIG.receiver);
        const transferred = receiverBalanceAfter - receiverBalanceBefore;
        
        console.log("Receiver balance after:", ethers.formatEther(receiverBalanceAfter), "ETH");
        console.log("Actual transferred amount:", ethers.formatEther(transferred), "ETH");
        
        return transferred === ethers.parseEther("0.002");
    }

    async run() {
        console.log("🎯 ERC-4337 + BLS Aggregate Signature Transfer");
        console.log("=".repeat(50));
        console.log("Dynamic Gas Validator:", CONFIG.validator);
        
        try {
            const accountAddress = await this.createOrGetAccount();
            const success = await this.performTransfer(accountAddress);
            
            if (success) {
                console.log("\n🏆 Transfer successful!");
                console.log("✅ ERC-4337 account abstraction working properly");
                console.log("✅ BLS aggregate signature verification passed");
                console.log("✅ Dynamic gas calculation optimization active");
            } else {
                console.log("\n❌ Transfer amount mismatch");
            }
            
        } catch (error) {
            console.error("❌ Transfer failed:", error.message);
        }
    }
}

// Main program entry point
if (import.meta.url === `file://${process.argv[1]}`) {
    const transfer = new ERC4337Transfer();
    transfer.run().catch(console.error);
}