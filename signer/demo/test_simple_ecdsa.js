import { ethers } from 'ethers';
import axios from 'axios';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    bundlerUrl: "https://api.pimlico.io/v2/11155111/rpc?apikey=pim_gcVkLnianG5Fj4AvFYhAEh",
    entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    account: "0x75815E5604317DA2b42705659e5459a7a8E58aAa",
    receiver: "0x35E3c67B42f301DC2879893A4073fC1d0c97a3b1"
};

const ACCOUNT_ABI = [
    "function execute(address dest, uint256 value, bytes calldata func) external"
];

const ENTRY_POINT_ABI = [
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)"
];

async function testSimpleECDSA() {
    console.log("🔍 Testing simple ECDSA signature with bundler...");
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
    const account = new ethers.Contract(CONFIG.account, ACCOUNT_ABI, provider);
    const entryPoint = new ethers.Contract(CONFIG.entryPoint, ENTRY_POINT_ABI, provider);
    
    // Get nonce
    const nonce = await entryPoint.getNonce(CONFIG.account, 0);
    console.log("Nonce:", nonce.toString());
    
    // Create UserOperation
    const callData = account.interface.encodeFunctionData("execute", [
        CONFIG.receiver,
        ethers.parseEther("0.0001"), // Small amount
        "0x"
    ]);
    
    const userOp = {
        sender: CONFIG.account,
        nonce: nonce,
        initCode: "0x",
        callData: callData,
        callGasLimit: 100000n,
        verificationGasLimit: 300000n,
        preVerificationGas: 50000n,
        maxFeePerGas: ethers.parseUnits("10", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
        paymasterAndData: "0x",
        signature: "0x"
    };
    
    // Calculate UserOp hash (ERC-4337 standard)
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
    const finalHash = ethers.keccak256(entryPointHash);
    
    console.log("UserOp hash:", finalHash);
    
    // Create simple ECDSA signature
    const signature = await wallet.signMessage(ethers.getBytes(finalHash));
    userOp.signature = signature;
    
    console.log("Signature created:", signature.slice(0, 20) + "...");
    console.log("Signature length:", signature.length);
    
    // Submit to bundler
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
    
    console.log("\nSubmitting to bundler...");
    
    try {
        const response = await axios.post(CONFIG.bundlerUrl, {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_sendUserOperation",
            params: [userOpForBundler, CONFIG.entryPoint]
        });
        
        if (response.data.error) {
            console.log("❌ Bundler error:", JSON.stringify(response.data.error));
            console.log("\nDiagnosis:");
            console.log("Since simple ECDSA also fails, the issue is NOT specific to BLS signatures.");
            console.log("The account expects BLS+ECDSA format when useAAStarValidator is true.");
        } else {
            console.log("✅ UserOperation submitted:", response.data.result);
        }
    } catch (error) {
        console.error("❌ Error:", error.message);
    }
}

testSimpleECDSA().catch(console.error);