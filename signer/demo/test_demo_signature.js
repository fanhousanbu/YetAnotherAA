import { ethers } from 'ethers';

// 直接使用demo.js生成的所有参数，但测试在我的账户上
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    validator: "0x0Fe448a612efD9B38287e25a208448315c2E2Df3",
    
    // demo.js的完整签名数据
    demoSignatureData: {
        userOpHash: "0x3e6f028455dcbace3dec0eb5e718ba5a16c2573a5fbadeec4a623392f06bde48",
        nodeIds: [
            "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
            "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
            "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
        ],
        blsSignature: "0x0000000000000000000000000000000013aed908821f255bef0ee685b462d9da85047132439cedb791f34b165fcfc7d8acf8a471c633eef891c240f3b80fadd6000000000000000000000000000000000a2ba6711f5a2f1a40e3ec41e81278c7e7d543a71d376ea3ce005772186fbd4dae8c2772839cc84faba6a494932e6fbd000000000000000000000000000000000c1d7cbabc2cd5a6e2d15ee14699e233b1cc0febf83f943cffbd6dc18f9d60319b7887c1fe353127d199b7e447bc1bcf000000000000000000000000000000001465035084aacd675829718ab2d1845690076a0ab604e37696c3e30b59e8614424159e97851e495ce89a1353aed374b1",
        messagePoint: "0x00000000000000000000000000000000145c415e19117351bd5014fbebd3f1994c002c8936696bc36bafd9fd3e50ceb27a7bd6841bb2b64f6fb33d8563f679530000000000000000000000000000000018c000b20b9d46cb0f4e60773f404670e0f1bbac417c3635e82b708bf13c06e7ce6c04f6641357846e36db73f50c348100000000000000000000000000000000034b92f5f55fc277a341d956fc1594ceb84b83649f6fa4ce821cf1fd50bb0996dd708d9b3a006ae61cf507861886c2e800000000000000000000000000000000134a875045299263ba87681b62c7df4fd75f5bb5a8cc972f091c12cb3aecbec9db3e05cacc221823672dfb1a0b685987",
        aaSignature: "0xb7a46001582df9cdc9bd470697a5a2d5d63536968256f52692c3f1a4443160e507d7828df602e94da725aeb74a5adb978281cc4b3c41280517fad1f645ce4a661b"
    }
};

const VALIDATOR_ABI = [
    "function validateAggregateSignature(bytes32[] calldata nodeIds, bytes calldata signature, bytes calldata messagePoint) external view returns (bool isValid)"
];

async function testDemoSignature() {
    console.log("🔍 测试demo.js生成的签名参数");
    console.log("=".repeat(40));
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const validator = new ethers.Contract(CONFIG.validator, VALIDATOR_ABI, provider);
    
    // 1. 先测试BLS部分是否正确
    console.log("🧪 测试BLS签名验证...");
    try {
        const isValid = await validator.validateAggregateSignature(
            CONFIG.demoSignatureData.nodeIds,
            CONFIG.demoSignatureData.blsSignature,
            CONFIG.demoSignatureData.messagePoint,
            { gasLimit: 1000000 }
        );
        console.log("BLS验证结果:", isValid ? "✅ 成功" : "❌ 失败");
        
        if (!isValid) {
            console.log("❌ BLS签名本身有问题");
            return;
        }
        
    } catch (error) {
        console.log("❌ BLS验证失败:", error.message);
        return;
    }
    
    // 2. 测试ECDSA签名恢复
    console.log("\n🔍 测试ECDSA签名恢复...");
    try {
        const hash = ethers.hashMessage(ethers.getBytes(CONFIG.demoSignatureData.userOpHash));
        const recoveredSigner = ethers.recoverAddress(hash, CONFIG.demoSignatureData.aaSignature);
        
        console.log("UserOpHash:", CONFIG.demoSignatureData.userOpHash);
        console.log("签名hash:", hash);
        console.log("恢复的签名者:", recoveredSigner);
        console.log("预期签名者:", "0x075F227E25a63417Bf66F6e751b376B09Fd43928");
        console.log("ECDSA匹配:", recoveredSigner.toLowerCase() === "0x075F227E25a63417Bf66F6e751b376B09Fd43928".toLowerCase() ? "✅" : "❌");
        
        // 3. 测试用我们的私钥重新签名
        console.log("\n🔧 使用我们的私钥重新签名...");
        const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
        const ourSignature = await wallet.signMessage(ethers.getBytes(CONFIG.demoSignatureData.userOpHash));
        const ourRecovered = ethers.recoverAddress(hash, ourSignature);
        
        console.log("我们的签名:", ourSignature);
        console.log("我们恢复的地址:", ourRecovered);
        console.log("我们的地址:", wallet.address);
        console.log("我们的签名正确:", ourRecovered.toLowerCase() === wallet.address.toLowerCase() ? "✅" : "❌");
        
        // 4. 创建完整签名用于测试
        console.log("\n📦 创建完整签名包...");
        
        const nodeIdsLength = ethers.solidityPacked(["uint256"], [CONFIG.demoSignatureData.nodeIds.length]);
        const nodeIdsBytes = ethers.solidityPacked(
            Array(CONFIG.demoSignatureData.nodeIds.length).fill("bytes32"),
            CONFIG.demoSignatureData.nodeIds
        );
        
        // 使用demo的BLS数据 + 我们的ECDSA签名
        const packedSignature = ethers.solidityPacked(
            ["bytes", "bytes", "bytes", "bytes", "bytes"],
            [
                nodeIdsLength,
                nodeIdsBytes,
                CONFIG.demoSignatureData.blsSignature,
                CONFIG.demoSignatureData.messagePoint,
                ourSignature // 使用我们的ECDSA签名
            ]
        );
        
        console.log("完整签名长度:", packedSignature.length / 2 - 1, "字节");
        console.log("\n📝 分析:");
        console.log("- BLS部分使用demo.js的数据:", CONFIG.demoSignatureData.userOpHash);
        console.log("- ECDSA部分使用我们的签名:", ourSignature);
        console.log("- 如果账户验证时匹配owner，应该能通过");
        
        return {
            packedSignature,
            userOpHash: CONFIG.demoSignatureData.userOpHash,
            blsValid: isValid,
            ecdsaValid: ourRecovered.toLowerCase() === wallet.address.toLowerCase()
        };
        
    } catch (error) {
        console.log("❌ ECDSA测试失败:", error.message);
    }
}

testDemoSignature().catch(console.error);