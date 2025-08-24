import { ethers } from 'ethers';
import axios from 'axios';

// Configuration
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    bundlerUrl: "https://api.pimlico.io/v2/11155111/rpc?apikey=pim_gcVkLnianG5Fj4AvFYhAEh",
    
    // Contract addresses from deployment
    entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    factory: "0x10a3253338D1E6Eb4ec6a35459Ad1C3BDb3E522c",
    validator: "0x6f5F51654eeDfDBba5E053d022A7282f63ec8687",
    testAccount: "0xb2078908379f8B32E6bD692dc48ed3627773f091",
    
    // BLS signing services
    blsServices: [
        "http://localhost:3001",
        "http://localhost:3002", 
        "http://localhost:3003"
    ],
    aggregationService: "http://localhost:3001",
    
    // Transfer configuration
    transferAmount: ethers.parseEther("0.001"), // 0.001 ETH
    
    // BLS nodes (first 3 nodes for testing)
    selectedNodes: [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d", // node_1
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272", // node_2  
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"  // node_3
    ]
};

// Contract ABIs (simplified)
const FACTORY_ABI = [
    "function createAccountWithAAStarValidator(address owner, address aaStarValidator, bool useAAStarValidator, uint256 salt) returns (address)",
    "function getAddress(address owner, uint256 salt) view returns (address)",
    "function getAddress(address owner, address aaStarValidator, bool useAAStarValidator, uint256 salt) view returns (address)"
];

const ACCOUNT_ABI = [
    "function execute(address dest, uint256 value, bytes calldata func) external",
    "function validateUserOp((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp, bytes32 userOpHash, uint256 missingAccountFunds) external returns (uint256)",
    "function getValidationConfig() external view returns (address validator, bool isAAStarEnabled, address accountOwner)"
];

const ENTRY_POINT_ABI = [
    "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address payable beneficiary) external",
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)"
];

class ERC4337Transfer {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(CONFIG.rpc);
        this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
        this.entryPoint = new ethers.Contract(CONFIG.entryPoint, ENTRY_POINT_ABI, this.provider);
        this.factory = new ethers.Contract(CONFIG.factory, FACTORY_ABI, this.provider);
    }

    async createAccounts() {
        console.log("🏭 Creating two test accounts for transfer...");
        
        // Create sender account with BLS validation
        const senderSalt = 11111;
        const senderAddress = await this.factory["getAddress(address,address,bool,uint256)"](
            this.wallet.address,    // owner
            CONFIG.validator,       // aaStarValidator
            true,                   // useAAStarValidator - enable BLS
            senderSalt              // salt
        );
        
        // Create receiver account with simple ECDSA
        const receiverSalt = 22222;
        const receiverAddress = await this.factory["getAddress(address,address,bool,uint256)"](
            this.wallet.address,    // owner
            "0x0000000000000000000000000000000000000000", // no validator
            false,                  // useAAStarValidator - disable BLS
            receiverSalt            // salt
        );

        console.log(`📤 Sender account: ${senderAddress}`);
        console.log(`📥 Receiver account: ${receiverAddress}`);

        // Check if accounts exist, create if needed
        const senderCode = await this.provider.getCode(senderAddress);
        if (senderCode === '0x') {
            console.log("Creating sender account...");
            const factoryWithSigner = this.factory.connect(this.wallet);
            const tx = await factoryWithSigner.createAccountWithAAStarValidator(
                this.wallet.address,
                CONFIG.validator,
                true,
                senderSalt
            );
            await tx.wait();
            console.log("✅ Sender account created");
        }

        const receiverCode = await this.provider.getCode(receiverAddress);
        if (receiverCode === '0x') {
            console.log("Creating receiver account...");
            const factoryWithSigner = this.factory.connect(this.wallet);
            const tx = await factoryWithSigner.createAccountWithAAStarValidator(
                this.wallet.address,
                "0x0000000000000000000000000000000000000000",
                false,
                receiverSalt
            );
            await tx.wait();
            console.log("✅ Receiver account created");
        }

        return { senderAddress, receiverAddress };
    }

    async fundAccount(accountAddress) {
        console.log(`💰 Funding account ${accountAddress} with 0.01 ETH...`);
        
        const tx = await this.wallet.sendTransaction({
            to: accountAddress,
            value: ethers.parseEther("0.01")
        });
        
        await tx.wait();
        const balance = await this.provider.getBalance(accountAddress);
        console.log(`✅ Account balance: ${ethers.formatEther(balance)} ETH`);
    }

    async createUserOperation(senderAddress, receiverAddress) {
        console.log("🔧 Creating UserOperation...");

        // Get nonce
        const nonce = await this.entryPoint.getNonce(senderAddress, 0);
        
        // Create call data for transfer
        const account = new ethers.Contract(senderAddress, ACCOUNT_ABI, this.provider);
        const callData = account.interface.encodeFunctionData("execute", [
            receiverAddress,
            CONFIG.transferAmount,
            "0x" // No additional data
        ]);

        // Build UserOperation
        const userOp = {
            sender: senderAddress,
            nonce: nonce,
            initCode: "0x",
            callData: callData,
            callGasLimit: 100000n,
            verificationGasLimit: 300000n,
            preVerificationGas: 50000n,
            maxFeePerGas: ethers.parseUnits("10", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
            paymasterAndData: "0x",
            signature: "0x" // Will be filled later
        };

        console.log("UserOperation created:", {
            sender: userOp.sender,
            nonce: userOp.nonce.toString(),
            transferTo: receiverAddress,
            amount: ethers.formatEther(CONFIG.transferAmount)
        });

        return userOp;
    }

    async calculateUserOpHash(userOp) {
        // Calculate UserOperation hash for signing
        const chainId = 11155111; // Sepolia
        
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
        
        const entryPointHash = ethers.solidityPacked(
            ["bytes32", "address", "uint256"],
            [userOpHash, CONFIG.entryPoint, chainId]
        );

        return ethers.keccak256(entryPointHash);
    }

    // Calculate simplified hash for BLS signing (matches demo.js format)
    calculateBLSMessageHash(userOp) {
        const packedUserOp = ethers.solidityPacked(
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
        
        return ethers.keccak256(packedUserOp);
    }

    async getBLSSignatures(messageHash, nodeIds) {
        console.log("🔐 Getting BLS signatures from nodes...");
        
        const signatures = [];
        
        for (let i = 0; i < nodeIds.length; i++) {
            const nodeId = nodeIds[i];
            const serviceUrl = CONFIG.blsServices[i];
            
            try {
                console.log(`Requesting signature from ${serviceUrl} for node ${nodeId.slice(0, 10)}...`);
                
                const response = await axios.post(`${serviceUrl}/signature/sign`, {
                    message: messageHash
                });

                // Check if response has signature directly or in a data field
                if (response.data && response.data.signature) {
                    signatures.push({
                        nodeId: nodeId,
                        signature: response.data.signature
                    });
                    console.log(`✅ Got signature from node ${nodeId.slice(0, 10)}`);
                } else {
                    console.log("Response data:", JSON.stringify(response.data, null, 2));
                    throw new Error(`No signature in response: ${JSON.stringify(response.data)}`);
                }
            } catch (error) {
                console.error(`❌ Failed to get signature from ${serviceUrl}:`, error.response?.data || error.message);
                throw error;
            }
        }

        return signatures;
    }

    async aggregateBLSSignatures(signatures, messageHash) {
        console.log("🔗 Aggregating BLS signatures...");
        
        try {
            const response = await axios.post(`${CONFIG.aggregationService}/signature/aggregate`, {
                signatures: signatures.map(s => s.signature)
            });

            console.log("Aggregation response:", JSON.stringify(response.data, null, 2));

            // Check different possible response formats
            if (response.data && response.data.signature) {
                console.log("✅ BLS signatures aggregated successfully");
                
                // Generate correct messagePoint if not provided by aggregation service
                const messagePoint = response.data.messagePoint || await this.generateMessagePoint(messageHash);
                
                return {
                    aggregatedSignature: response.data.signature,
                    messagePoint: messagePoint,
                    nodeIds: signatures.map(s => s.nodeId)
                };
            } else {
                throw new Error(`Aggregation failed: ${JSON.stringify(response.data)}`);
            }
        } catch (error) {
            console.error("❌ Failed to aggregate signatures:", error.response?.data || error.message);
            throw error;
        }
    }

    // Generate G2 messagePoint from hash (matches BLS service implementation)
    async generateMessagePoint(messageHash) {
        // Import BLS library for G2 point generation
        const { bls12_381: bls } = await import('@noble/curves/bls12-381.js');
        const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
        
        // Convert hash to bytes and generate G2 point
        const messageBytes = ethers.getBytes(messageHash);
        const messagePoint = await bls.G2.hashToCurve(messageBytes, { DST });
        
        // Encode to EIP-2537 format (256 bytes)
        return this.encodeG2Point(messagePoint);
    }

    // EIP-2537 format encoding (G2 point, 256 bytes)
    encodeG2Point(point) {
        const result = new Uint8Array(256);
        const affine = point.toAffine();
        
        const x0Bytes = this.hexToBytes(affine.x.c0.toString(16).padStart(96, '0'));
        const x1Bytes = this.hexToBytes(affine.x.c1.toString(16).padStart(96, '0'));
        const y0Bytes = this.hexToBytes(affine.y.c0.toString(16).padStart(96, '0'));
        const y1Bytes = this.hexToBytes(affine.y.c1.toString(16).padStart(96, '0'));
        
        result.set(x0Bytes, 16);
        result.set(x1Bytes, 80);
        result.set(y0Bytes, 144);
        result.set(y1Bytes, 208);
        return "0x" + Buffer.from(result).toString('hex');
    }

    // Convert hexadecimal string to byte array
    hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    async createAAStarSignature(userOpHash, blsData) {
        console.log("🔏 Creating AAStarValidator signature...");

        // Create AA signature for userOpHash (dual verification)
        const aaSignature = await this.wallet.signMessage(ethers.getBytes(userOpHash));
        
        // Pack signature in AAStarValidator format:
        // [nodeIdsLength(32)][nodeIds...][blsSignature(256)][messagePoint(256)][aaSignature(65)]
        
        const nodeIdsLength = ethers.solidityPacked(["uint256"], [blsData.nodeIds.length]);
        const nodeIdsBytes = ethers.solidityPacked(
            Array(blsData.nodeIds.length).fill("bytes32"),
            blsData.nodeIds
        );

        const packedSignature = ethers.solidityPacked(
            ["bytes", "bytes", "bytes", "bytes", "bytes"],
            [
                nodeIdsLength,
                nodeIdsBytes,
                blsData.aggregatedSignature,
                blsData.messagePoint,
                aaSignature
            ]
        );

        console.log("✅ AAStarValidator signature created");
        console.log(`- Node IDs: ${blsData.nodeIds.length}`);
        console.log(`- BLS signature length: ${blsData.aggregatedSignature.length}`);
        console.log(`- Message point length: ${blsData.messagePoint.length}`);
        console.log(`- AA signature length: ${aaSignature.length}`);
        console.log(`- Total signature length: ${packedSignature.length}`);

        return packedSignature;
    }

    async submitUserOperation(userOp) {
        console.log("📤 Submitting UserOperation to bundler...");

        // Convert BigInt values to strings for JSON serialization
        const serializedUserOp = {
            sender: userOp.sender,
            nonce: "0x" + userOp.nonce.toString(16),
            initCode: userOp.initCode,
            callData: userOp.callData,
            callGasLimit: "0x" + userOp.callGasLimit.toString(16),
            verificationGasLimit: "0x" + userOp.verificationGasLimit.toString(16),
            preVerificationGas: "0x" + userOp.preVerificationGas.toString(16),
            maxFeePerGas: "0x" + userOp.maxFeePerGas.toString(16),
            maxPriorityFeePerGas: "0x" + userOp.maxPriorityFeePerGas.toString(16),
            paymasterAndData: userOp.paymasterAndData,
            signature: userOp.signature
        };

        try {
            const response = await axios.post(CONFIG.bundlerUrl, {
                jsonrpc: "2.0",
                id: 1,
                method: "eth_sendUserOperation",
                params: [serializedUserOp, CONFIG.entryPoint]
            });

            if (response.data.result) {
                console.log("✅ UserOperation submitted successfully");
                console.log(`UserOp hash: ${response.data.result}`);
                return response.data.result;
            } else {
                throw new Error(`Bundler error: ${JSON.stringify(response.data.error)}`);
            }
        } catch (error) {
            console.error("❌ Failed to submit UserOperation:", error.message);
            throw error;
        }
    }

    async waitForUserOpReceipt(userOpHash) {
        console.log("⏳ Waiting for UserOperation to be mined...");
        
        for (let i = 0; i < 60; i++) { // Wait up to 5 minutes
            try {
                const response = await axios.post(CONFIG.bundlerUrl, {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "eth_getUserOperationReceipt",
                    params: [userOpHash]
                });

                if (response.data.result) {
                    console.log("✅ UserOperation mined!");
                    console.log(`Transaction hash: ${response.data.result.transactionHash}`);
                    console.log(`Block number: ${response.data.result.blockNumber}`);
                    return response.data.result;
                }
            } catch (error) {
                // Ignore error, keep waiting
            }

            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        }

        throw new Error("UserOperation not mined within timeout");
    }

    async run() {
        try {
            console.log("🚀 Starting ERC-4337 BLS Transfer Test");
            console.log("=====================================");

            // Step 1: Create accounts
            const { senderAddress, receiverAddress } = await this.createAccounts();

            // Step 2: Fund sender account
            await this.fundAccount(senderAddress);

            // Step 3: Create UserOperation
            const userOp = await this.createUserOperation(senderAddress, receiverAddress);

            // Step 4: Calculate UserOp hash for AA signature  
            const userOpHash = await this.calculateUserOpHash(userOp);
            console.log(`📝 UserOp hash (for AA sig): ${userOpHash}`);

            // Step 5: Calculate BLS message hash (simplified format)
            const blsMessageHash = this.calculateBLSMessageHash(userOp);
            console.log(`🔐 BLS message hash: ${blsMessageHash}`);

            // Step 6: Get BLS signatures using BLS message hash
            const blsSignatures = await this.getBLSSignatures(blsMessageHash, CONFIG.selectedNodes);

            // Step 7: Aggregate BLS signatures (use BLS message hash)
            const blsData = await this.aggregateBLSSignatures(blsSignatures, blsMessageHash);

            // Step 8: Create final signature (use userOpHash for AA signature)
            const signature = await this.createAAStarSignature(userOpHash, blsData);
            userOp.signature = signature;

            // Step 9: Submit UserOperation
            const userOpHash2 = await this.submitUserOperation(userOp);

            // Step 10: Wait for confirmation
            const receipt = await this.waitForUserOpReceipt(userOpHash2);

            // Step 11: Verify transfer
            console.log("🔍 Verifying transfer...");
            const receiverBalance = await this.provider.getBalance(receiverAddress);
            console.log(`Receiver balance: ${ethers.formatEther(receiverBalance)} ETH`);

            console.log("✅ ERC-4337 BLS Transfer Test Completed Successfully!");
            console.log("====================================================");

        } catch (error) {
            console.error("❌ Test failed:", error.message);
            console.error(error.stack);
        }
    }
}

// Run the transfer test
const transfer = new ERC4337Transfer();
transfer.run().catch(console.error);

export default ERC4337Transfer;