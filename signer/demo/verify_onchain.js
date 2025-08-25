import { ethers } from 'ethers';
import axios from 'axios';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    account: "0x75815E5604317DA2b42705659e5459a7a8E58aAa",
    validator: "0x91Fc1Ff9646A2e5F09525837769F25c87777A07F",
    entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789"
};

const VALIDATOR_ABI = [
    "function validateAggregateSignature(bytes32[] calldata nodeIds, bytes calldata signature, bytes calldata messagePoint) external view returns (bool isValid)"
];

async function verify() {
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
    const validator = new ethers.Contract(CONFIG.validator, VALIDATOR_ABI, provider);
    
    // Test BLS hash from previous run
    const blsHash = "0x923676f588e6a65055d56c728976a766881dfc2d0891c4401f929c58167b55c6";
    
    // Get BLS signatures from services
    console.log("Getting BLS signatures...");
    const nodeIds = [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
    ];
    
    const signatures = [];
    for (let i = 0; i < 3; i++) {
        const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
            message: blsHash
        });
        signatures.push(response.data.signature);
        console.log(`Got signature from node ${i+1}`);
    }
    
    // Aggregate signatures
    console.log("Aggregating signatures...");
    const aggResponse = await axios.post(`http://localhost:3001/signature/aggregate`, {
        signatures: signatures
    });
    const aggregatedSignature = aggResponse.data.signature;
    
    // Generate messagePoint
    console.log("Generating messagePoint...");
    const { bls12_381: bls } = await import('@noble/curves/bls12-381.js');
    const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
    
    const messageBytes = ethers.getBytes(blsHash);
    const messagePoint_G2 = await bls.G2.hashToCurve(messageBytes, { DST });
    
    // Encode to EIP-2537 format
    const result = new Uint8Array(256);
    const affine = messagePoint_G2.toAffine();
    
    function hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }
    
    const x0Bytes = hexToBytes(affine.x.c0.toString(16).padStart(96, '0'));
    const x1Bytes = hexToBytes(affine.x.c1.toString(16).padStart(96, '0'));
    const y0Bytes = hexToBytes(affine.y.c0.toString(16).padStart(96, '0'));
    const y1Bytes = hexToBytes(affine.y.c1.toString(16).padStart(96, '0'));
    
    result.set(x0Bytes, 16);
    result.set(x1Bytes, 80);
    result.set(y0Bytes, 144);
    result.set(y1Bytes, 208);
    
    const messagePoint = "0x" + Buffer.from(result).toString('hex');
    
    // Verify on-chain
    console.log("\nVerifying BLS signature on-chain...");
    console.log("Validator:", CONFIG.validator);
    console.log("Node IDs:", nodeIds.length);
    console.log("Signature length:", aggregatedSignature.length);
    console.log("MessagePoint length:", messagePoint.length);
    
    try {
        const isValid = await validator.validateAggregateSignature(
            nodeIds,
            aggregatedSignature,
            messagePoint
        );
        console.log("✅ BLS validation result:", isValid);
        
        if (isValid) {
            console.log("\n✅ BLS signature verification successful!");
            console.log("The BLS aggregate signature system is working correctly.");
        } else {
            console.log("\n❌ BLS signature verification failed");
        }
    } catch (error) {
        console.error("❌ Validation error:", error.message);
    }
}

verify().catch(console.error);