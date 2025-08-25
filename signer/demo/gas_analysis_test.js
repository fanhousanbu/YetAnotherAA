import { ethers } from 'ethers';
import axios from 'axios';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    account: "0x75815E5604317DA2b42705659e5459a7a8E58aAa",
    validator: "0x91Fc1Ff9646A2e5F09525837769F25c87777A07F"
};

const VALIDATOR_ABI = [
    "function validateAggregateSignature(bytes32[] calldata nodeIds, bytes calldata signature, bytes calldata messagePoint) external view returns (bool isValid)"
];

async function gasAnalysisTest() {
    console.log("🔍 Analyzing gas usage in BLS validation");
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const validator = new ethers.Contract(CONFIG.validator, VALIDATOR_ABI, provider);
    
    // Create a test hash
    const testHash = ethers.keccak256(ethers.toUtf8Bytes("test"));
    console.log("Test hash:", testHash);
    
    const nodeIds = [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
    ];
    
    // Get BLS signatures for the test hash
    console.log("\n🔧 Getting BLS signatures for test...");
    const signatures = [];
    for (let i = 0; i < 3; i++) {
        const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
            message: testHash
        });
        signatures.push(response.data.signature);
        console.log(`Got signature from node ${i+1}`);
    }
    
    // Aggregate signatures
    const aggResponse = await axios.post(`http://localhost:3001/signature/aggregate`, {
        signatures: signatures
    });
    const aggregatedSignature = aggResponse.data.signature;
    console.log("Signatures aggregated");
    
    // Generate messagePoint
    const { bls12_381: bls } = await import('@noble/curves/bls12-381.js');
    const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
    
    const messageBytes = ethers.getBytes(testHash);
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
    
    console.log("\n🧪 Testing BLS validation with different gas limits...");
    
    const gasLimits = [150000, 250000, 350000, 500000, 750000, 1000000];
    
    for (const gasLimit of gasLimits) {
        try {
            console.log(`\nTesting with gas limit: ${gasLimit.toLocaleString()}`);
            
            // Estimate gas first
            const estimatedGas = await validator.validateAggregateSignature.estimateGas(
                nodeIds,
                aggregatedSignature,
                messagePoint
            );
            console.log(`  Estimated gas: ${estimatedGas.toString()}`);
            
            // Try the actual call with gas limit
            const isValid = await validator.validateAggregateSignature(
                nodeIds,
                aggregatedSignature,
                messagePoint,
                { gasLimit: gasLimit }
            );
            console.log(`  ✅ SUCCESS: ${isValid}`);
            
            if (isValid) {
                console.log(`\n🎯 MINIMUM WORKING GAS LIMIT: ${gasLimit.toLocaleString()}`);
                break;
            }
            
        } catch (error) {
            console.log(`  ❌ FAILED: ${error.message.substring(0, 100)}...`);
            
            if (error.message.includes("out of gas")) {
                console.log("     Reason: Out of gas");
            } else if (error.message.includes("execution reverted")) {
                console.log("     Reason: Execution reverted (might be validation failure)");
            }
        }
    }
    
    console.log("\n📊 Analysis:");
    console.log("If BLS validation works with higher gas limits, then the issue in");
    console.log("simulateValidation is likely due to insufficient gas allocation");
    console.log("for the complex BLS verification operations.");
    console.log("\nThe contract allocates 200,000 gas for pairing check, but BLS");
    console.log("operations might need more gas than that in practice.");
}

gasAnalysisTest().catch(console.error);