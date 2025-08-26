#!/usr/bin/env node
/**
 * ERC-4337 + BLS Transfer Tool
 * Complete ERC-4337 account abstraction transfer tool with integrated BLS aggregate signature functionality
 */

import { ethers } from "ethers";
import { bls12_381 } from "@noble/curves/bls12-381.js";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load configuration from config.json
const configData = JSON.parse(readFileSync(join(__dirname, "config.json"), "utf8"));

// Configuration
const CONFIG = {
  rpc: configData.rpcConfig.ethRpcUrl,
  bundlerRpc: configData.rpcConfig.bundlerRpcUrl,
  privateKey: configData.ownerAccount.privateKey, // Owner private key for funding and deployment
  aaPrivateKey: configData.aaAccount.privateKey, // AA account private key for signatures
  aaAddress: configData.aaAccount.address, // AA account address
  entryPoint: configData.contractInfo.entryPoint.address,
  factory: configData.contractInfo.accountFactory.address,
  validator: configData.contractInfo.validator.address,
  receiver: "0x962753056921000790fb7Fe7C2dCA3006bA605f3",
  selectedNodes: [
    configData.keyPairs[0].contractNodeId,
    configData.keyPairs[1].contractNodeId,
    configData.keyPairs[2].contractNodeId,
  ],
};

const FACTORY_ABI = [
  "function getAddress(address owner, address validator, bool useAAStarValidator, uint256 salt) view returns (address)",
  "function createAccountWithAAStarValidator(address owner, address aaStarValidator, bool useAAStarValidator, uint256 salt) returns (address)",
];

const ACCOUNT_ABI = ["function execute(address dest, uint256 value, bytes calldata func) external"];

const ENTRY_POINT_ABI = [
  "function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external",
  "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)",
  "function getUserOpHash((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external view returns (bytes32)",
  "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address payable beneficiary) external",
];

const VALIDATOR_ABI = [
  "function getGasEstimate(uint256 nodeCount) external pure returns (uint256 gasEstimate)",
];

// ============================================================================
// BLS Signature Generation Functions
// ============================================================================

// EIP-2537 format encoding (G2 point, 256 bytes)
function encodeG2Point(point) {
  const result = new Uint8Array(256);
  const affine = point.toAffine();

  const x0Bytes = hexToBytes(affine.x.c0.toString(16).padStart(96, "0"));
  const x1Bytes = hexToBytes(affine.x.c1.toString(16).padStart(96, "0"));
  const y0Bytes = hexToBytes(affine.y.c0.toString(16).padStart(96, "0"));
  const y1Bytes = hexToBytes(affine.y.c1.toString(16).padStart(96, "0"));

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
  const contractConfig = JSON.parse(readFileSync(join(__dirname, "config.json"), "utf8"));

  // Validate node indices
  const indices = nodeIndices.map(n => n - 1);
  for (const index of indices) {
    if (index < 0 || index >= contractConfig.keyPairs.length) {
      throw new Error(
        `Node index ${index + 1} is out of range (1-${contractConfig.keyPairs.length})`
      );
    }
  }

  // Get selected nodes
  const selectedNodes = indices.map(i => contractConfig.keyPairs[i]);

  // BLS signature parameters
  const messageBytes = ethers.getBytes(userOpHash);
  const DST = "BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_";
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
    throw new Error("Aggregate signature verification failed");
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
    signature: "0x" + Buffer.from(aggregatedSignatureEIP).toString("hex"),
    messagePoint: "0x" + Buffer.from(messageG2EIP).toString("hex"),
    aaAddress: aaAccount.address,
    aaSignature: aaSignature,
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
    const owner = CONFIG.aaAddress; // Use AA account address as owner

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
          maxPriorityFeePerGas: ethers.parseUnits("10", "gwei"),
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
        maxPriorityFeePerGas: ethers.parseUnits("10", "gwei"),
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
    console.log(
      `Gas estimate (${CONFIG.selectedNodes.length} nodes):`,
      Number(gasEstimate).toLocaleString()
    );

    const account = new ethers.Contract(accountAddress, ACCOUNT_ABI, this.provider);
    const nonce = await this.entryPoint.getNonce(accountAddress, 0);

    const callData = account.interface.encodeFunctionData("execute", [
      CONFIG.receiver,
      ethers.parseEther("0.002"), // Transfer 0.002 ETH
      "0x",
    ]);

    // Create initial UserOp for gas estimation
    const baseUserOp = {
      sender: accountAddress,
      nonce: "0x" + nonce.toString(16),
      initCode: "0x",
      callData: callData,
      callGasLimit: "0x0",
      verificationGasLimit: "0x0",
      preVerificationGas: "0x0",
      maxFeePerGas: "0x" + ethers.parseUnits("30", "gwei").toString(16),
      maxPriorityFeePerGas: "0x" + ethers.parseUnits("10", "gwei").toString(16),
      paymasterAndData: "0x",
      signature: "0x",
    };

    // Estimate gas using Pimlico
    console.log("Estimating gas costs...");
    const gasEstimates = await this.estimateUserOpGas(baseUserOp);

    const userOp = {
      sender: accountAddress,
      nonce: nonce,
      initCode: "0x",
      callData: callData,
      callGasLimit: BigInt(gasEstimates.callGasLimit),
      verificationGasLimit: BigInt(gasEstimates.verificationGasLimit),
      preVerificationGas: BigInt(gasEstimates.preVerificationGas),
      maxFeePerGas: ethers.parseUnits("30", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("10", "gwei"),
      paymasterAndData: "0x",
      signature: "0x",
    };

    console.log("Gas estimates:", {
      callGasLimit: gasEstimates.callGasLimit,
      verificationGasLimit: gasEstimates.verificationGasLimit,
      preVerificationGas: gasEstimates.preVerificationGas,
    });

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
      userOp.signature,
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
      [nodeIdsLength, nodeIdsBytes, blsData.signature, blsData.messagePoint, blsData.aaSignature]
    );

    userOp.signature = packedSignature;

    // Execute transfer via Pimlico bundler
    const receiverBalanceBefore = await this.provider.getBalance(CONFIG.receiver);
    console.log("Receiver balance before:", ethers.formatEther(receiverBalanceBefore), "ETH");

    console.log("Submitting UserOp to Pimlico bundler...");
    const bundlerUserOpHash = await this.submitUserOpToBundler(userOp);
    console.log("UserOp submitted, hash:", bundlerUserOpHash);

    // Wait for transaction to be mined
    const txHash = await this.waitForUserOpTransaction(bundlerUserOpHash);
    console.log("Transaction hash:", txHash);

    // Get transaction receipt
    const receipt = await this.provider.getTransactionReceipt(txHash);
    console.log("Gas used:", receipt.gasUsed.toString());

    // Check results
    const receiverBalanceAfter = await this.provider.getBalance(CONFIG.receiver);
    const transferred = receiverBalanceAfter - receiverBalanceBefore;

    console.log("Receiver balance after:", ethers.formatEther(receiverBalanceAfter), "ETH");
    console.log("Actual transferred amount:", ethers.formatEther(transferred), "ETH");

    return transferred === ethers.parseEther("0.002");
  }

  async estimateUserOpGas(userOp) {
    const bundlerProvider = new ethers.JsonRpcProvider(CONFIG.bundlerRpc);

    try {
      const gasEstimates = await bundlerProvider.send("eth_estimateUserOperationGas", [
        userOp,
        CONFIG.entryPoint,
      ]);

      return {
        callGasLimit: gasEstimates.callGasLimit,
        verificationGasLimit: gasEstimates.verificationGasLimit,
        preVerificationGas: gasEstimates.preVerificationGas,
      };
    } catch (error) {
      console.warn("Gas estimation failed, using default values:", error.message);
      return {
        callGasLimit: "0x249f0", // 150000
        verificationGasLimit: "0xf4240", // 1000000
        preVerificationGas: "0x11170", // 70000
      };
    }
  }

  async submitUserOpToBundler(userOp) {
    const bundlerProvider = new ethers.JsonRpcProvider(CONFIG.bundlerRpc);

    // Convert userOp to bundler format
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
      signature: userOp.signature,
    };

    try {
      const result = await bundlerProvider.send("eth_sendUserOperation", [
        userOpForBundler,
        CONFIG.entryPoint,
      ]);
      return result;
    } catch (error) {
      console.error("Bundler submission error:", error);
      throw error;
    }
  }

  async waitForUserOpTransaction(userOpHash) {
    const bundlerProvider = new ethers.JsonRpcProvider(CONFIG.bundlerRpc);
    const maxAttempts = 60; // Increased to 2 minutes
    const pollInterval = 2000; // 2 seconds

    console.log("Waiting for UserOp to be mined...");

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const receipt = await bundlerProvider.send("eth_getUserOperationReceipt", [userOpHash]);

        if (receipt && (receipt.transactionHash || receipt.receipt?.transactionHash)) {
          console.log("✅ UserOp mined successfully!");
          console.log("Block number:", receipt.blockNumber || receipt.receipt?.blockNumber);
          const txHash = receipt.transactionHash || receipt.receipt?.transactionHash;
          console.log("Actual gas used:", parseInt(receipt.actualGasUsed || "0x0", 16));
          return txHash;
        }
      } catch (error) {
        // Receipt not yet available, continue polling
        if (attempt % 10 === 9) {
          console.log(`⏳ Still waiting for UserOp to be mined... (${attempt + 1}/${maxAttempts})`);
        }
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    // Try one more time to get the receipt for debugging
    try {
      const receipt = await bundlerProvider.send("eth_getUserOperationReceipt", [userOpHash]);
      console.log("Final receipt check:", receipt);
    } catch (error) {
      console.log("No receipt available:", error.message);
    }

    throw new Error(
      `UserOp transaction timeout - not mined within ${(maxAttempts * pollInterval) / 1000} seconds. UserOpHash: ${userOpHash}`
    );
  }

  async run() {
    console.log("🎯 ERC-4337 + BLS Aggregate Signature Transfer");
    console.log("=".repeat(50));
    console.log("Validator:", CONFIG.validator);

    try {
      const accountAddress = await this.createOrGetAccount();
      const success = await this.performTransfer(accountAddress);

      if (success) {
        console.log("\n🏆 Transfer successful!");
        console.log("✅ ERC-4337 account abstraction working properly");
        console.log("✅ BLS aggregate signature verification passed");
        console.log("✅ Gas optimization active");
        console.log("✅ Pimlico bundler integration successful");
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
