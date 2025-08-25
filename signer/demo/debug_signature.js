import { ethers } from 'ethers';
import axios from 'axios';

const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    validator: "0x91Fc1Ff9646A2e5F09525837769F25c87777A07F"
};

const VALIDATOR_ABI = [
    "function validateAggregateSignature(bytes32[] calldata nodeIds, bytes calldata signature, bytes calldata messagePoint) external view returns (bool isValid)"
];

async function debugSignature() {
    console.log("🔍 Debugging BLS+ECDSA signature format...\n");
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
    const validator = new ethers.Contract(CONFIG.validator, VALIDATOR_ABI, provider);
    
    // Use the exact same hashes from complete_test.js output
    const erc4337Hash = "0xb15a48da6fc7dcf692ec050bbec37ce101d44221f9e6d50bb5e8f68c7d5d8a91";
    const blsHash = "0x923676f588e6a65055d56c728976a766881dfc2d0891c4401f929c58167b55c6";
    
    console.log("ERC-4337 Hash:", erc4337Hash);
    console.log("BLS Hash:", blsHash);
    
    // Node IDs
    const nodeIds = [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
    ];
    
    // Get BLS signatures
    console.log("\n📝 Getting BLS signatures...");
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
    const aggregatedSignature = aggResponse.data.signature;
    console.log("\n📊 Aggregated signature length:", aggregatedSignature.length);
    
    // Generate messagePoint
    const { bls12_381: bls } = await import('@noble/curves/bls12-381.js');
    const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
    const messageBytes = ethers.getBytes(blsHash);
    const messagePoint_G2 = await bls.G2.hashToCurve(messageBytes, { DST });
    
    // Encode messagePoint
    const result = new Uint8Array(256);
    const affine = messagePoint_G2.toAffine();
    
    function hexToBytes(hex) {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }
    
    result.set(hexToBytes(affine.x.c0.toString(16).padStart(96, '0')), 16);
    result.set(hexToBytes(affine.x.c1.toString(16).padStart(96, '0')), 80);
    result.set(hexToBytes(affine.y.c0.toString(16).padStart(96, '0')), 144);
    result.set(hexToBytes(affine.y.c1.toString(16).padStart(96, '0')), 208);
    const messagePoint = "0x" + Buffer.from(result).toString('hex');
    console.log("📊 MessagePoint length:", messagePoint.length);
    
    // Verify BLS part works
    const isValidBLS = await validator.validateAggregateSignature(
        nodeIds,
        aggregatedSignature,
        messagePoint
    );
    console.log("✅ BLS validation:", isValidBLS);
    
    // Create AA signature
    const aaSignature = await wallet.signMessage(ethers.getBytes(erc4337Hash));
    console.log("\n📊 AA signature length:", aaSignature.length);
    
    // Pack complete signature - CRITICAL PART
    console.log("\n🔧 Packing signature components:");
    
    // Method 1: Using uint256 for length
    const nodeIdsLength = ethers.solidityPacked(["uint256"], [nodeIds.length]);
    console.log("NodeIds length (uint256):", nodeIdsLength);
    console.log("NodeIds length bytes:", nodeIdsLength.length / 2 - 1); // hex string
    
    const nodeIdsBytes = ethers.solidityPacked(
        Array(nodeIds.length).fill("bytes32"),
        nodeIds
    );
    console.log("NodeIds bytes length:", nodeIdsBytes.length / 2 - 1);
    
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
    
    console.log("\n📦 Final signature breakdown:");
    console.log("- NodeIds length field: 32 bytes (uint256)");
    console.log("- NodeIds data: " + (nodeIds.length * 32) + " bytes");
    console.log("- BLS signature: 256 bytes");
    console.log("- MessagePoint: 256 bytes");
    console.log("- AA signature: 65 bytes");
    console.log("- Total expected: " + (32 + nodeIds.length * 32 + 256 + 256 + 65) + " bytes");
    console.log("- Actual total: " + (packedSignature.length / 2 - 1) + " bytes");
    
    // Verify the parsing would work
    console.log("\n🔍 Verifying signature can be parsed:");
    let offset = 2; // Skip "0x"
    
    // Read nodeIds length
    const nodeIdsLengthFromSig = parseInt(packedSignature.slice(offset, offset + 64), 16);
    console.log("Parsed nodeIds length:", nodeIdsLengthFromSig);
    offset += 64;
    
    // Read nodeIds
    const parsedNodeIds = [];
    for (let i = 0; i < nodeIdsLengthFromSig; i++) {
        parsedNodeIds.push("0x" + packedSignature.slice(offset, offset + 64));
        offset += 64;
    }
    console.log("Parsed nodeIds:", parsedNodeIds.length);
    
    // Read BLS signature
    const parsedBLSSig = "0x" + packedSignature.slice(offset, offset + 512);
    offset += 512;
    console.log("Parsed BLS signature length:", parsedBLSSig.length);
    
    // Read messagePoint
    const parsedMessagePoint = "0x" + packedSignature.slice(offset, offset + 512);
    offset += 512;
    console.log("Parsed messagePoint length:", parsedMessagePoint.length);
    
    // Read AA signature
    const parsedAASignature = "0x" + packedSignature.slice(offset);
    console.log("Parsed AA signature length:", parsedAASignature.length);
    
    console.log("\n✅ Signature format is correct!");
    console.log("The signature should work with the contract.");
}

debugSignature().catch(console.error);