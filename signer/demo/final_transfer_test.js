import { ethers } from 'ethers';
import axios from 'axios';

// 最终转账测试 - 完整的ERC-4337流程
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
    "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address payable beneficiary) external",
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)",
    "function getUserOpHash((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external view returns (bytes32)"
];

const ACCOUNT_ABI = [
    "function execute(address dest, uint256 value, bytes calldata func) external"
];

class FinalTransferTest {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(CONFIG.rpc);
        this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
        this.entryPoint = new ethers.Contract(CONFIG.entryPoint, ENTRY_POINT_ABI, this.wallet);
        this.account = new ethers.Contract(CONFIG.account, ACCOUNT_ABI, this.provider);
    }

    async createUserOp() {
        console.log("🔧 创建UserOperation...");
        
        const nonce = await this.entryPoint.getNonce(CONFIG.account, 0);
        const callData = this.account.interface.encodeFunctionData("execute", [
            CONFIG.receiver,
            ethers.parseEther("0.001"), // 转账金额
            "0x"
        ]);
        
        const userOp = {
            sender: CONFIG.account,
            nonce: nonce,
            initCode: "0x",
            callData: callData,
            callGasLimit: 100000n,
            verificationGasLimit: 1000000n, // 增加验证gas
            preVerificationGas: 60000n,
            maxFeePerGas: ethers.parseUnits("20", "gwei"), // 增加gas价格
            maxPriorityFeePerGas: ethers.parseUnits("5", "gwei"),
            paymasterAndData: "0x",
            signature: "0x"
        };
        
        console.log("✅ UserOperation创建完成, nonce:", nonce.toString());
        return userOp;
    }

    async getCorrectUserOpHash(userOp) {
        // 使用EntryPoint的getUserOpHash获得正确的hash
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
        
        const hash = await this.entryPoint.getUserOpHash(userOpArray);
        console.log("✅ 从EntryPoint获得正确hash:", hash);
        return hash;
    }

    async createBLSSignature(userOpHash) {
        console.log("🔧 创建BLS+ECDSA签名...");
        
        // 获取BLS签名
        const signatures = [];
        for (let i = 0; i < 3; i++) {
            const response = await axios.post(`http://localhost:300${i+1}/signature/sign`, {
                message: userOpHash
            });
            signatures.push(response.data.signature);
            console.log(`✅ 节点 ${i+1} BLS签名完成`);
        }
        
        // 聚合BLS签名
        const aggResponse = await axios.post(`http://localhost:3001/signature/aggregate`, {
            signatures: signatures
        });
        const aggregatedSignature = aggResponse.data.signature;
        console.log("✅ BLS签名聚合完成");
        
        // 生成messagePoint
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
        console.log("✅ MessagePoint生成完成");
        
        // 创建ECDSA签名
        const aaSignature = await this.wallet.signMessage(ethers.getBytes(userOpHash));
        console.log("✅ ECDSA签名完成");
        
        // 打包完整签名
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
        
        console.log(`✅ 签名打包完成 (${packedSignature.length / 2 - 1} 字节)`);
        return packedSignature;
    }

    async executeTransfer(userOp) {
        console.log("\n🚀 执行转账交易...");
        
        try {
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
            
            // 获取转账前余额
            const receiverBalanceBefore = await this.provider.getBalance(CONFIG.receiver);
            console.log("转账前接收者余额:", ethers.formatEther(receiverBalanceBefore), "ETH");
            
            // 执行handleOps
            const tx = await this.entryPoint.handleOps(
                [userOpArray],
                this.wallet.address, // beneficiary
                {
                    gasLimit: 2000000, // 高gas限制
                    maxFeePerGas: ethers.parseUnits("50", "gwei"),
                    maxPriorityFeePerGas: ethers.parseUnits("10", "gwei")
                }
            );
            
            console.log("交易已提交, hash:", tx.hash);
            console.log("等待确认...");
            
            const receipt = await tx.wait();
            console.log("✅ 交易确认, gas使用:", receipt.gasUsed.toString());
            
            // 检查转账结果
            const receiverBalanceAfter = await this.provider.getBalance(CONFIG.receiver);
            const transferred = receiverBalanceAfter - receiverBalanceBefore;
            
            console.log("\n📊 转账结果:");
            console.log("转账后接收者余额:", ethers.formatEther(receiverBalanceAfter), "ETH");
            console.log("实际转账金额:", ethers.formatEther(transferred), "ETH");
            
            if (transferred === ethers.parseEther("0.001")) {
                console.log("🎉 转账成功!");
                return true;
            } else {
                console.log("❌ 转账金额不符");
                return false;
            }
            
        } catch (error) {
            console.log("❌ 交易执行失败:", error.message);
            
            if (error.reason) {
                console.log("失败原因:", error.reason);
            }
            
            return false;
        }
    }

    async run() {
        console.log("🎯 最终BLS+ERC-4337转账测试");
        console.log("=".repeat(50));
        console.log("账户:", CONFIG.account);
        console.log("接收者:", CONFIG.receiver);
        console.log("转账金额: 0.001 ETH");
        
        try {
            // 1. 创建UserOperation
            const userOp = await this.createUserOp();
            
            // 2. 获取正确的hash
            const userOpHash = await this.getCorrectUserOpHash(userOp);
            
            // 3. 创建签名
            const signature = await this.createBLSSignature(userOpHash);
            userOp.signature = signature;
            
            // 4. 执行转账
            const success = await this.executeTransfer(userOp);
            
            if (success) {
                console.log("\n🏆 完全成功!");
                console.log("✅ BLS聚合签名系统工作正常");
                console.log("✅ ERC-4337账户抽象工作正常");
                console.log("✅ Gas修复版本工作正常");
                console.log("✅ 转账验证完成!");
                
                console.log("\n🎊 系统已完全部署并验证!");
            } else {
                console.log("\n❌ 转账失败");
            }
            
        } catch (error) {
            console.error("❌ 测试失败:", error.message);
        }
    }
}

const test = new FinalTransferTest();
test.run().catch(console.error);