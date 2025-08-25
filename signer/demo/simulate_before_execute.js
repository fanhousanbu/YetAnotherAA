import { ethers } from 'ethers';
import axios from 'axios';

// 先用simulateValidation检查，再决定是否执行
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    
    account: "0x18d9066EA77558c71286b84FcBbA924077F9E24e",
    receiver: "0x962753056921000790fb7Fe7C2dCA3006bA605f3",
    
    selectedNodes: [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
    ]
};

const ENTRY_POINT_ABI = [
    "function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external",
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)",
    "function getUserOpHash((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external view returns (bytes32)"
];

const ACCOUNT_ABI = [
    "function execute(address dest, uint256 value, bytes calldata func) external"
];

async function simulateBeforeExecute() {
    console.log("🔍 模拟验证测试");
    console.log("=".repeat(30));
    
    const provider = new ethers.JsonRpcProvider(CONFIG.rpc);
    const wallet = new ethers.Wallet(CONFIG.privateKey, provider);
    const entryPoint = new ethers.Contract(CONFIG.entryPoint, ENTRY_POINT_ABI, wallet);
    const account = new ethers.Contract(CONFIG.account, ACCOUNT_ABI, provider);
    
    // 1. 创建UserOperation
    const nonce = await entryPoint.getNonce(CONFIG.account, 0);
    const callData = account.interface.encodeFunctionData("execute", [
        CONFIG.receiver,
        ethers.parseEther("0.001"),
        "0x"
    ]);
    
    const userOp = {
        sender: CONFIG.account,
        nonce: nonce,
        initCode: "0x",
        callData: callData,
        callGasLimit: 100000n,
        verificationGasLimit: 1000000n,
        preVerificationGas: 60000n,
        maxFeePerGas: ethers.parseUnits("20", "gwei"),
        maxPriorityFeePerGas: ethers.parseUnits("5", "gwei"),
        paymasterAndData: "0x",
        signature: "0x"
    };
    
    console.log("UserOp nonce:", nonce.toString());
    
    // 2. 获取正确hash
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
        userOp.signature
    ];
    
    const userOpHash = await entryPoint.getUserOpHash(userOpArray);
    console.log("UserOp hash:", userOpHash);
    
    // 3. 创建签名
    console.log("\n🔧 创建签名...");
    const signatures = [];
    for (let i = 0; i < 3; i++) {
        const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
            message: userOpHash
        });
        signatures.push(response.data.signature);
    }
    
    const aggResponse = await axios.post(`http://localhost:3001/signature/aggregate`, {
        signatures: signatures
    });
    const aggregatedSignature = aggResponse.data.signature;
    
    const { bls12_381: bls } = await import('@noble/curves/bls12-381.js');
    const DST = 'BLS_SIG_BLS12381G2_XMD:SHA-256_SSWU_RO_POP_';
    
    const messageBytes = ethers.getBytes(userOpHash);
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
    
    const aaSignature = await wallet.signMessage(ethers.getBytes(userOpHash));
    
    const nodeIdsLength = ethers.solidityPacked(["uint256"], [CONFIG.selectedNodes.length]);
    const nodeIdsBytes = ethers.solidityPacked(
        Array(CONFIG.selectedNodes.length).fill("bytes32"),
        CONFIG.selectedNodes
    );
    
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
    
    userOp.signature = packedSignature;
    console.log("✅ 签名完成");
    
    // 4. 模拟验证
    console.log("\n🧪 执行模拟验证...");
    try {
        const finalUserOpArray = [
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
            userOp.signature
        ];
        
        await entryPoint.simulateValidation(finalUserOpArray);
        console.log("❓ 没有revert - 这很奇怪");
        
    } catch (error) {
        if (error.data && error.data.startsWith("0xe0cff05f")) {
            try {
                const resultData = "0x" + error.data.slice(10);
                const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                    ["tuple(uint256 preOpGas, uint256 prefund, bool sigFailed, uint48 validAfter, uint48 validUntil, bytes paymasterContext)"],
                    resultData
                );
                
                const result = decoded[0];
                console.log("📊 模拟结果:");
                console.log("  preOpGas:", result.preOpGas.toString());
                console.log("  prefund:", ethers.formatEther(result.prefund), "ETH");
                console.log("  sigFailed:", result.sigFailed);
                
                if (!result.sigFailed) {
                    console.log("\n🎉 模拟验证成功!");
                    console.log("✅ BLS+ECDSA签名验证通过");
                    console.log("✅ Gas修复版本工作正常");
                    console.log("✅ 转账验证完成!");
                    
                    // 检查账户余额是否足够
                    const accountBalance = await provider.getBalance(CONFIG.account);
                    const requiredAmount = result.prefund;
                    
                    console.log("\n💰 余额检查:");
                    console.log("账户余额:", ethers.formatEther(accountBalance), "ETH");
                    console.log("所需金额:", ethers.formatEther(requiredAmount), "ETH");
                    console.log("余额充足:", accountBalance >= requiredAmount ? "✅" : "❌");
                    
                    if (accountBalance >= requiredAmount) {
                        console.log("\n🏆 系统完全正常!");
                        console.log("BLS聚合签名+ERC-4337账户抽象系统运行正常!");
                    } else {
                        console.log("\n💸 账户余额不足，需要充值");
                    }
                    
                } else {
                    console.log("\n❌ 模拟验证失败");
                    console.log("签名有问题");
                }
                
            } catch (decodeError) {
                console.log("❌ 解析失败:", decodeError.message);
            }
        } else {
            console.log("❌ 非预期错误:", error.message);
        }
    }
}

simulateBeforeExecute().catch(console.error);