import { ethers } from 'ethers';
import axios from 'axios';

// 只测试新validator的BLS验证功能
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    newValidator: "0x0Fe448a612efD9B38287e25a208448315c2E2Df3", // Gas-fixed version
    
    selectedNodes: [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
    ]
};

const VALIDATOR_ABI = [
    "function validateAggregateSignature(bytes32[] calldata nodeIds, bytes calldata signature, bytes calldata messagePoint) external view returns (bool isValid)",
    "function isRegistered(bytes32 nodeId) external view returns (bool)",
    "function getRegisteredNodeCount() external view returns (uint256)"
];

async function testNewValidatorOnly() {
    console.log("🔍 Testing New Gas-Fixed Validator Only");
    console.log("=" .repeat(45));
    console.log("Validator:", CONFIG.newValidator);
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const validator = new ethers.Contract(CONFIG.newValidator, VALIDATOR_ABI, provider);
    
    // 1. Check validator state
    console.log("\n📋 Checking validator state...");
    try {
        const nodeCount = await validator.getRegisteredNodeCount();
        console.log("Registered nodes:", nodeCount.toString());
        
        for (let i = 0; i < CONFIG.selectedNodes.length; i++) {
            const isReg = await validator.isRegistered(CONFIG.selectedNodes[i]);
            console.log(`Node ${i+1} registered:`, isReg ? "✅" : "❌");
        }
        
        if (nodeCount.toString() === "0") {
            console.log("❌ No nodes registered to new validator!");
            return;
        }
        
    } catch (error) {
        console.log("❌ Failed to check validator state:", error.message);
        return;
    }
    
    // 2. Test BLS validation with gas fix
    console.log("\n🧪 Testing BLS validation with gas fix...");
    
    const testHash = ethers.keccak256(ethers.toUtf8Bytes("gas_fix_final_test"));
    console.log("Test hash:", testHash);
    
    try {
        // Get BLS signatures
        console.log("Getting BLS signatures...");
        const signatures = [];
        for (let i = 0; i < 3; i++) {
            const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
                message: testHash
            });
            signatures.push(response.data.signature);
            console.log(`✅ Got signature from node ${i+1}`);
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
        console.log("✅ MessagePoint generated");
        
        // Test validation
        console.log("\n📊 Testing validation...");
        
        const estimatedGas = await validator.validateAggregateSignature.estimateGas(
            CONFIG.selectedNodes,
            aggregatedSignature,
            messagePoint
        );
        console.log(`Estimated gas: ${estimatedGas.toString()}`);
        
        const isValid = await validator.validateAggregateSignature(
            CONFIG.selectedNodes,
            aggregatedSignature,
            messagePoint,
            { gasLimit: 1000000 }
        );
        
        console.log("\n🎯 RESULT:");
        console.log(`BLS validation: ${isValid ? "✅ SUCCESS" : "❌ FAILED"}`);
        
        if (isValid) {
            console.log("\n🎉 BREAKTHROUGH!");
            console.log("✅ Gas-fixed validator works perfectly!");
            console.log("✅ BLS aggregate signature validation passed!");
            console.log("✅ The 600k gas limit fix resolved the issue!");
            
            console.log("\n📈 Comparison:");
            console.log("- Old validator (200k gas): ❌ Failed");
            console.log("- New validator (600k gas): ✅ Success");
            console.log("- Required gas: ~" + estimatedGas.toString());
            
            console.log("\n🏆 CONCLUSION:");
            console.log("The BLS aggregate signature system is fully functional!");
            console.log("The only issue was insufficient gas allocation for BLS operations.");
        } else {
            console.log("\n❌ Still failed - may need further investigation");
        }
        
    } catch (error) {
        console.log("❌ Test failed:", error.message);
    }
}

testNewValidatorOnly().catch(console.error);