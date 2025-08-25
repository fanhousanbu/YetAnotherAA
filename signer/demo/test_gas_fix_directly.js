import { ethers } from 'ethers';
import axios from 'axios';

// 使用新的gas-fixed validator但用已存在的账户
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    
    // 使用已存在的账户，但切换到新的validator
    account: "0x75815E5604317DA2b42705659e5459a7a8E58aAa", 
    newValidator: "0x0Fe448a612efD9B38287e25a208448315c2E2Df3", // Gas-fixed version
    
    selectedNodes: [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
    ]
};

const VALIDATOR_ABI = [
    "function validateAggregateSignature(bytes32[] calldata nodeIds, bytes calldata signature, bytes calldata messagePoint) external view returns (bool isValid)"
];

const ACCOUNT_ABI = [
    "function setAAStarValidator(address _aaStarValidator) external",
    "function getValidationConfig() external view returns (address validator, bool isAAStarEnabled, address accountOwner)"
];

async function testGasFixDirectly() {
    console.log("🔍 Testing Gas Fix Directly on New Validator");
    console.log("=" .repeat(50));
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
    const validator = new ethers.Contract(CONFIG.newValidator, VALIDATOR_ABI, provider);
    const account = new ethers.Contract(CONFIG.account, ACCOUNT_ABI, wallet);
    
    // 1. 更新账户使用新的validator
    console.log("🔧 Updating account to use gas-fixed validator...");
    try {
        const currentConfig = await account.getValidationConfig();
        console.log("Current validator:", currentConfig.validator);
        console.log("New validator:", CONFIG.newValidator);
        
        if (currentConfig.validator.toLowerCase() !== CONFIG.newValidator.toLowerCase()) {
            console.log("Switching to new validator...");
            const updateTx = await account.setAAStarValidator(CONFIG.newValidator, {
                maxFeePerGas: ethers.parseUnits("30", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("5", "gwei")
            });
            await updateTx.wait();
            console.log("✅ Validator updated");
        } else {
            console.log("✅ Already using new validator");
        }
    } catch (error) {
        console.log("❌ Failed to update validator:", error.message);
        return;
    }
    
    // 2. 测试新validator的BLS验证
    console.log("\n🧪 Testing gas-fixed BLS validation...");
    
    const testHash = ethers.keccak256(ethers.toUtf8Bytes("gas_fix_test"));
    console.log("Test hash:", testHash);
    
    // Get BLS signatures
    console.log("Getting BLS signatures...");
    const signatures = [];
    for (let i = 0; i < 3; i++) {
        const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
            message: testHash
        });
        signatures.push(response.data.signature);
        console.log(`Got signature from node ${i+1}`);
    }
    
    // Aggregate
    const aggResponse = await axios.post(`http://localhost:3001/signature/aggregate`, {
        signatures: signatures
    });
    const aggregatedSignature = aggResponse.data.signature;
    
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
    
    // Test with different gas limits
    console.log("\n📊 Testing gas-fixed validator:");
    
    try {
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
        
        console.log(`✅ Gas-fixed validation result: ${isValid}`);
        
        if (isValid) {
            console.log("\n🎉 SUCCESS!");
            console.log("✅ Gas fix worked!");
            console.log("✅ BLS aggregate signature validation passed!");
            console.log("The increased gas limit (600k) in the contract resolved the issue!");
        } else {
            console.log("\n❌ Still failed - may need other fixes");
        }
        
    } catch (error) {
        console.log(`❌ Test failed: ${error.message}`);
    }
}

testGasFixDirectly().catch(console.error);