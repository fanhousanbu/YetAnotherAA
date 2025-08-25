import { ethers } from 'ethers';
import axios from 'axios';

// Configuration with new deployed contracts
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    bundlerUrl: "https://api.pimlico.io/v2/11155111/rpc?apikey=pim_gcVkLnianG5Fj4AvFYhAEh",
    
    // New deployed contract addresses
    entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    factory: "0xCA837737D80574E041a35F5395D7032E55E27D62",
    validator: "0x91Fc1Ff9646A2e5F09525837769F25c87777A07F",
    
    // BLS signing services (ports 3001-3003)
    blsServices: [
        "http://localhost:3001",
        "http://localhost:3002", 
        "http://localhost:3003"
    ],
    aggregationService: "http://localhost:3001",
    
    // Selected nodes for signing (using first 3)
    selectedNodes: [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d", // node_1
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272", // node_2  
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"  // node_3
    ]
};

// ABIs
const FACTORY_ABI = [
    "function getAddress(address owner, address validator, bool useAAStarValidator, uint256 salt) view returns (address)",
    "function createAccountWithAAStarValidator(address owner, address aaStarValidator, bool useAAStarValidator, uint256 salt) returns (address)",
    "function accountImplementation() view returns (address)"
];

const ACCOUNT_ABI = [
    "function execute(address dest, uint256 value, bytes calldata func) external",
    "function getValidationConfig() external view returns (address validator, bool isAAStarEnabled, address accountOwner)"
];

const ENTRY_POINT_ABI = [
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)"
];

class CompleteTest {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(CONFIG.rpc);
        this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
        this.factory = new ethers.Contract(CONFIG.factory, FACTORY_ABI, this.wallet);
        this.entryPoint = new ethers.Contract(CONFIG.entryPoint, ENTRY_POINT_ABI, this.provider);
    }

    // Step 1: Create or get test account with BLS validation
    async createTestAccounts() {
        console.log("🏭 Creating test accounts with BLS validation...");
        
        const salt = 0;
        const owner = this.wallet.address;
        
        // Get account addresses
        const senderAddress = await this.factory["getAddress(address,address,bool,uint256)"](
            owner,
            CONFIG.validator,
            true, // Enable AAStarValidator
            salt
        );
        
        const receiverAddress = await this.factory["getAddress(address,address,bool,uint256)"](
            owner,
            CONFIG.validator,
            true,
            salt + 1
        );
        
        console.log(`📤 Sender account: ${senderAddress}`);
        console.log(`📥 Receiver account: ${receiverAddress}`);
        
        // Check if accounts need deployment
        const senderCode = await this.provider.getCode(senderAddress);
        if (senderCode === "0x") {
            console.log("Deploying sender account...");
            const tx = await this.factory.createAccountWithAAStarValidator(
                owner,
                CONFIG.validator,
                true,
                salt
            );
            await tx.wait();
            console.log("✅ Sender account deployed");
        }
        
        // Fund sender account
        const balance = await this.provider.getBalance(senderAddress);
        if (balance < ethers.parseEther("0.01")) {
            console.log("💰 Funding sender account...");
            const fundTx = await this.wallet.sendTransaction({
                to: senderAddress,
                value: ethers.parseEther("0.01")
            });
            await fundTx.wait();
            console.log("✅ Account funded");
        }
        
        return { senderAddress, receiverAddress };
    }

    // Step 2: Create UserOperation
    async createUserOperation(senderAddress, receiverAddress) {
        console.log("🔧 Creating UserOperation...");
        
        const account = new ethers.Contract(senderAddress, ACCOUNT_ABI, this.provider);
        const nonce = await this.entryPoint.getNonce(senderAddress, 0);
        
        // Create transfer calldata
        const callData = account.interface.encodeFunctionData("execute", [
            receiverAddress,
            ethers.parseEther("0.001"),
            "0x"
        ]);
        
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
        
        console.log("✅ UserOperation created");
        return userOp;
    }

    // Step 3: Calculate hashes (dual hash approach)
    calculateHashes(userOp) {
        console.log("📝 Calculating hashes...");
        
        // ERC-4337 standard hash for AA signature
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
        const chainId = 11155111; // Sepolia
        const entryPointHash = ethers.solidityPacked(
            ["bytes32", "address", "uint256"],
            [userOpHash, CONFIG.entryPoint, chainId]
        );
        const erc4337Hash = ethers.keccak256(entryPointHash);
        
        // Simplified hash for BLS signatures
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
        
        console.log(`✅ ERC-4337 hash: ${erc4337Hash}`);
        console.log(`✅ BLS hash: ${blsHash}`);
        
        return { erc4337Hash, blsHash };
    }

    // Step 4: Get BLS signatures from services
    async getBLSSignatures(messageHash, nodeIds) {
        console.log("🔐 Getting BLS signatures from nodes...");
        
        const signatures = [];
        for (let i = 0; i < nodeIds.length && i < CONFIG.blsServices.length; i++) {
            const serviceUrl = CONFIG.blsServices[i];
            const nodeId = nodeIds[i];
            
            try {
                console.log(`Requesting from ${serviceUrl}...`);
                const response = await axios.post(`${serviceUrl}/signature/sign`, {
                    message: messageHash
                });
                
                signatures.push({
                    nodeId: nodeId,
                    signature: response.data.signature,
                    publicKey: response.data.publicKey
                });
                console.log(`✅ Got signature from node ${i + 1}`);
            } catch (error) {
                console.error(`❌ Failed to get signature from ${serviceUrl}:`, error.message);
                throw error;
            }
        }
        
        return signatures;
    }

    // Step 5: Aggregate BLS signatures
    async aggregateBLSSignatures(signatures, messageHash) {
        console.log("🔗 Aggregating BLS signatures...");
        
        try {
            const response = await axios.post(`${CONFIG.aggregationService}/signature/aggregate`, {
                signatures: signatures.map(s => s.signature)
            });
            
            if (!response.data || !response.data.signature) {
                throw new Error("Invalid aggregation response");
            }
            
            console.log("✅ Signatures aggregated");
            
            // Generate messagePoint if not provided
            const messagePoint = await this.generateMessagePoint(messageHash);
            
            return {
                aggregatedSignature: response.data.signature,
                messagePoint: messagePoint,
                nodeIds: signatures.map(s => s.nodeId)
            };
        } catch (error) {
            console.error("❌ Aggregation failed:", error.message);
            throw error;
        }
    }

    // Generate G2 messagePoint from hash
    async generateMessagePoint(messageHash) {
        const { bls12_381: bls } = await import('@noble/curves/bls12-381.js');
        const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
        
        const messageBytes = ethers.getBytes(messageHash);
        const messagePoint = await bls.G2.hashToCurve(messageBytes, { DST });
        
        return this.encodeG2Point(messagePoint);
    }

    // Encode G2 point to EIP-2537 format
    encodeG2Point(point) {
        const result = new Uint8Array(256);
        const affine = point.toAffine();
        
        const hexToBytes = (hex) => {
            const bytes = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) {
                bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
            }
            return bytes;
        };
        
        const x0Bytes = hexToBytes(affine.x.c0.toString(16).padStart(96, '0'));
        const x1Bytes = hexToBytes(affine.x.c1.toString(16).padStart(96, '0'));
        const y0Bytes = hexToBytes(affine.y.c0.toString(16).padStart(96, '0'));
        const y1Bytes = hexToBytes(affine.y.c1.toString(16).padStart(96, '0'));
        
        result.set(x0Bytes, 16);
        result.set(x1Bytes, 80);
        result.set(y0Bytes, 144);
        result.set(y1Bytes, 208);
        
        return "0x" + Buffer.from(result).toString('hex');
    }

    // Step 6: Create complete AAStarValidator signature
    async createAAStarSignature(erc4337Hash, blsData) {
        console.log("🔏 Creating AAStarValidator signature...");
        
        // Create AA signature with ERC-4337 hash
        const aaSignature = await this.wallet.signMessage(ethers.getBytes(erc4337Hash));
        
        // Pack the complete signature
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
        
        console.log(`✅ Signature created (${packedSignature.length} bytes)`);
        return packedSignature;
    }

    // Step 7: Submit to bundler
    async submitUserOperation(userOp) {
        console.log("📤 Submitting UserOperation to bundler...");
        
        // Convert BigInt to hex strings for JSON serialization
        const userOpForBundler = {
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
                params: [userOpForBundler, CONFIG.entryPoint]
            });
            
            if (response.data.error) {
                throw new Error(`Bundler error: ${JSON.stringify(response.data.error)}`);
            }
            
            const userOpHash = response.data.result;
            console.log(`✅ UserOperation submitted: ${userOpHash}`);
            return userOpHash;
        } catch (error) {
            console.error("❌ Failed to submit UserOperation:", error.message);
            throw error;
        }
    }

    // Step 8: Wait for confirmation
    async waitForUserOpReceipt(userOpHash) {
        console.log("⏳ Waiting for UserOperation receipt...");
        
        const maxAttempts = 30;
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const response = await axios.post(CONFIG.bundlerUrl, {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "eth_getUserOperationReceipt",
                    params: [userOpHash]
                });
                
                if (response.data.result) {
                    console.log("✅ UserOperation confirmed!");
                    return response.data.result;
                }
            } catch (error) {
                // Ignore errors and continue polling
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            process.stdout.write(".");
        }
        
        throw new Error("UserOperation receipt timeout");
    }

    // Main execution
    async run() {
        try {
            console.log("🚀 Starting Complete ERC-4337 BLS Transfer Test");
            console.log("=" .repeat(50));
            
            // Step 1: Create test accounts
            const { senderAddress, receiverAddress } = await this.createTestAccounts();
            
            // Step 2: Create UserOperation
            const userOp = await this.createUserOperation(senderAddress, receiverAddress);
            
            // Step 3: Calculate hashes
            const { erc4337Hash, blsHash } = this.calculateHashes(userOp);
            
            // Step 4: Get BLS signatures
            const blsSignatures = await this.getBLSSignatures(blsHash, CONFIG.selectedNodes);
            
            // Step 5: Aggregate BLS signatures
            const blsData = await this.aggregateBLSSignatures(blsSignatures, blsHash);
            
            // Step 6: Create complete signature
            const signature = await this.createAAStarSignature(erc4337Hash, blsData);
            userOp.signature = signature;
            
            // Step 7: Submit to bundler
            const userOpHash = await this.submitUserOperation(userOp);
            
            // Step 8: Wait for confirmation
            const receipt = await this.waitForUserOpReceipt(userOpHash);
            
            // Verify transfer
            console.log("\n🔍 Verifying transfer...");
            const receiverBalance = await this.provider.getBalance(receiverAddress);
            console.log(`Receiver balance: ${ethers.formatEther(receiverBalance)} ETH`);
            
            console.log("\n✅ Complete test successful!");
            console.log("Transaction hash:", receipt.transactionHash);
            
        } catch (error) {
            console.error("\n❌ Test failed:", error.message);
            throw error;
        }
    }
}

// Execute the test
const test = new CompleteTest();
test.run().catch(console.error);