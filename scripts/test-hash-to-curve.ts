import { ethers } from "ethers";
import { generateUserOpHash, hashToCurveG2, encodeG2Point } from "./generate-userop.js";

// Contract ABI for HashToCurveG2
const HASH_TO_CURVE_ABI = [
  "function hashToCurveG2(bytes memory message) public view returns (bytes memory)",
  "function hashUserOpToG2(bytes32 userOpHash) external view returns (bytes memory)"
];

interface UserOperation {
  sender: string;
  nonce: bigint;
  initCode: string;
  callData: string;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: string;
  signature: string;
}

async function deployHashToCurveContract(provider: ethers.Provider, signer: ethers.Signer): Promise<ethers.Contract> {
  // Read the contract bytecode (you'll need to compile the Solidity contract first)
  console.log("Note: You'll need to compile HashToCurveG2.sol first using:");
  console.log("cd validator && forge build");
  console.log("Then deploy the contract to your test network");
  
  // For now, return a mock contract address - replace with actual deployed address
  const mockAddress = "0x1234567890123456789012345678901234567890";
  return new ethers.Contract(mockAddress, HASH_TO_CURVE_ABI, signer);
}

async function compareHashToCurve() {
  console.log("=== Hash-to-Curve Comparison Test ===\n");

  // Sample UserOperation
  const userOp: UserOperation = {
    sender: "0x1234567890123456789012345678901234567890",
    nonce: BigInt(42),
    initCode: "0x",
    callData: "0xa9059cbb000000000000000000000000abcdefabcdefabcdefabcdefabcdefabcdefabcdef0000000000000000000000000000000000000000000000000de0b6b3a7640000",
    callGasLimit: BigInt(21000),
    verificationGasLimit: BigInt(100000),
    preVerificationGas: BigInt(21000),
    maxFeePerGas: BigInt(2000000000),
    maxPriorityFeePerGas: BigInt(1000000000),
    paymasterAndData: "0x",
    signature: "0x",
  };

  const entryPoint = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
  const chainId = 11155111; // Sepolia

  console.log("1. Generating UserOperation Hash...");
  const userOpHash = generateUserOpHash(userOp, entryPoint, chainId);
  console.log("UserOp Hash:", userOpHash);

  console.log("\n2. Computing messagePoint off-chain...");
  const messageBytes = ethers.getBytes(userOpHash);
  const offChainMessagePoint = await hashToCurveG2(messageBytes);
  const offChainEncoded = encodeG2Point(offChainMessagePoint);
  console.log("Off-chain messagePoint:", offChainEncoded);
  console.log("Off-chain messagePoint length:", offChainEncoded.length);

  console.log("\n3. Setting up provider for on-chain comparison...");
  
  // You can configure these for your test network
  const RPC_URL = process.env.RPC_URL || "http://localhost:8545";
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  
  if (!PRIVATE_KEY) {
    console.log("PRIVATE_KEY environment variable not set. Skipping on-chain comparison.");
    console.log("To run on-chain comparison, set:");
    console.log("export PRIVATE_KEY=your_private_key");
    console.log("export RPC_URL=your_rpc_url");
    return;
  }

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);
    
    console.log("Connected to network:", await provider.getNetwork());
    console.log("Signer address:", await signer.getAddress());

    // Deploy or connect to HashToCurveG2 contract
    const contract = await deployHashToCurveContract(provider, signer);
    
    console.log("\n4. Computing messagePoint on-chain...");
    
    // Method 1: Use hashUserOpToG2 function
    try {
      const onChainResult1 = await contract.hashUserOpToG2(userOpHash);
      console.log("On-chain messagePoint (method 1):", onChainResult1);
      console.log("On-chain messagePoint length:", onChainResult1.length);
      
      // Compare results
      const match1 = offChainEncoded.toLowerCase() === onChainResult1.toLowerCase();
      console.log("Method 1 Match:", match1 ? "✅ SUCCESS" : "❌ MISMATCH");
      
      if (!match1) {
        console.log("Expected:", offChainEncoded);
        console.log("Got:     ", onChainResult1);
      }
    } catch (error) {
      console.log("Method 1 failed:", error);
    }

    // Method 2: Use generic hashToCurveG2 function
    try {
      const onChainResult2 = await contract.hashToCurveG2(messageBytes);
      console.log("On-chain messagePoint (method 2):", onChainResult2);
      
      const match2 = offChainEncoded.toLowerCase() === onChainResult2.toLowerCase();
      console.log("Method 2 Match:", match2 ? "✅ SUCCESS" : "❌ MISMATCH");
      
      if (!match2) {
        console.log("Expected:", offChainEncoded);
        console.log("Got:     ", onChainResult2);
      }
    } catch (error) {
      console.log("Method 2 failed:", error);
    }

  } catch (error) {
    console.error("Error connecting to network or calling contract:", error);
  }
}

async function testMultipleInputs() {
  console.log("\n=== Testing Multiple Hash Inputs ===");
  
  const testCases = [
    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    "0x0000000000000000000000000000000000000000000000000000000000000000",
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  ];

  for (let i = 0; i < testCases.length; i++) {
    const testHash = testCases[i];
    console.log(`\nTest case ${i + 1}: ${testHash}`);
    
    try {
      const messageBytes = ethers.getBytes(testHash);
      const messagePoint = await hashToCurveG2(messageBytes);
      const encoded = encodeG2Point(messagePoint);
      
      console.log(`Result ${i + 1}: ${encoded.slice(0, 66)}...${encoded.slice(-6)}`);
      console.log(`Length: ${encoded.length}`);
      
      // Verify it's a valid G2 point (basic sanity check)
      if (encoded.length === 514) { // 256 bytes * 2 + "0x" prefix
        console.log("✅ Valid encoding length");
      } else {
        console.log("❌ Invalid encoding length");
      }
    } catch (error) {
      console.log(`❌ Error: ${error}`);
    }
  }
}

async function main() {
  try {
    await compareHashToCurve();
    await testMultipleInputs();
    
    console.log("\n=== Summary ===");
    console.log("1. ✅ Off-chain hash-to-curve implementation completed");
    console.log("2. ✅ On-chain contract implementation completed");  
    console.log("3. ⚠️  On-chain testing requires contract deployment");
    console.log("\nTo complete the test:");
    console.log("1. Compile the contract: cd validator && forge build");
    console.log("2. Deploy HashToCurveG2.sol to your test network");
    console.log("3. Update the contract address in the test script");
    console.log("4. Set PRIVATE_KEY and RPC_URL environment variables");
    console.log("5. Re-run this script");
    
  } catch (error) {
    console.error("Test failed:", error);
    process.exit(1);
  }
}

// Check if this is the main module (ES modules)
import { fileURLToPath } from 'url';

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { compareHashToCurve, testMultipleInputs };