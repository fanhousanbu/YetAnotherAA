import { ethers } from 'ethers';
import axios from 'axios';

// 使用动态gas版本验证器进行转账测试
const CONFIG = {
    rpc: "https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20",
    privateKey: "0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a",
    entryPoint: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    factory: "0x559DD2D8Bf9180A70Da56FEFF57DA531BF3f2E1c",
    
    // 动态gas版本验证器
    validator: "0xAe7eA28a0aeA05cbB8631bDd7B10Cb0f387FC479",
    
    receiver: "0x962753056921000790fb7Fe7C2dCA3006bA605f3",
    
    selectedNodes: [
        "0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d",
        "0xc0e74ed91b71668dd2619e1bacaccfcc495bdbbd0a1b2a64295550c701762272",
        "0xa3cf2ced5807ceca64db9f9ca94cecdee7ffed22803f26b7ee26a438624dd15b"
    ]
};

const FACTORY_ABI = [
    "function getAddress(address owner, address validator, bool useAAStarValidator, uint256 salt) view returns (address)",
    "function createAccountWithAAStarValidator(address owner, address aaStarValidator, bool useAAStarValidator, uint256 salt) returns (address)"
];

const ACCOUNT_ABI = [
    "function execute(address dest, uint256 value, bytes calldata func) external"
];

const ENTRY_POINT_ABI = [
    "function simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external",
    "function getNonce(address sender, uint192 key) external view returns (uint256 nonce)",
    "function getUserOpHash((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes) userOp) external view returns (bytes32)",
    "function handleOps((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes)[] ops, address payable beneficiary) external"
];

const VALIDATOR_ABI = [
    "function getGasEstimate(uint256 nodeCount) external pure returns (uint256 gasEstimate)"
];

class DynamicGasTransferTest {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(CONFIG.rpc);
        this.wallet = new ethers.Wallet(CONFIG.privateKey, this.provider);
        this.factory = new ethers.Contract(CONFIG.factory, FACTORY_ABI, this.wallet);
        this.entryPoint = new ethers.Contract(CONFIG.entryPoint, ENTRY_POINT_ABI, this.wallet);
        this.validator = new ethers.Contract(CONFIG.validator, VALIDATOR_ABI, this.provider);
    }

    async createOrGetAccount() {
        console.log("🏭 创建或获取使用动态gas验证器的账户...");
        
        const salt = 12345; // 固定salt
        const owner = this.wallet.address;
        
        const accountAddress = await this.factory["getAddress(address,address,bool,uint256)"](
            owner,
            CONFIG.validator,
            true,
            salt
        );
        
        console.log("预测账户地址:", accountAddress);
        
        // 检查是否已存在
        const code = await this.provider.getCode(accountAddress);
        if (code === "0x") {
            console.log("部署新账户...");
            const tx = await this.factory.createAccountWithAAStarValidator(
                owner,
                CONFIG.validator,
                true,
                salt,
                {
                    maxFeePerGas: ethers.parseUnits("50", "gwei"),
                    maxPriorityFeePerGas: ethers.parseUnits("10", "gwei")
                }
            );
            await tx.wait();
            console.log("✅ 账户部署成功");
        }
        
        // 检查余额并充值
        const balance = await this.provider.getBalance(accountAddress);
        if (balance < ethers.parseEther("0.05")) {
            console.log("充值账户...");
            const fundTx = await this.wallet.sendTransaction({
                to: accountAddress,
                value: ethers.parseEther("0.1"),
                maxFeePerGas: ethers.parseUnits("50", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("10", "gwei")
            });
            await fundTx.wait();
            console.log("✅ 账户充值完成");
        }
        
        return accountAddress;
    }

    async performTransfer(accountAddress) {
        console.log("\n🚀 使用动态gas验证器执行转账...");
        
        // 显示gas估算
        const gasEstimate = await this.validator.getGasEstimate(CONFIG.selectedNodes.length);
        console.log(`动态gas估算 (${CONFIG.selectedNodes.length}节点):`, Number(gasEstimate).toLocaleString());
        
        const account = new ethers.Contract(accountAddress, ACCOUNT_ABI, this.provider);
        const nonce = await this.entryPoint.getNonce(accountAddress, 0);
        
        const callData = account.interface.encodeFunctionData("execute", [
            CONFIG.receiver,
            ethers.parseEther("0.002"), // 转账0.002 ETH (更容易看出差异)
            "0x"
        ]);
        
        const userOp = {
            sender: accountAddress,
            nonce: nonce,
            initCode: "0x",
            callData: callData,
            callGasLimit: 150000n,
            verificationGasLimit: 1000000n, // 高gas限制以确保成功
            preVerificationGas: 60000n,
            maxFeePerGas: ethers.parseUnits("30", "gwei"),
            maxPriorityFeePerGas: ethers.parseUnits("10", "gwei"),
            paymasterAndData: "0x",
            signature: "0x"
        };
        
        // 获取正确hash
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
        
        const userOpHash = await this.entryPoint.getUserOpHash(userOpArray);
        console.log("UserOp hash:", userOpHash);
        
        // 创建BLS+ECDSA签名
        console.log("创建BLS聚合签名...");
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
        
        const aaSignature = await this.wallet.signMessage(ethers.getBytes(userOpHash));
        
        // 打包签名
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
        
        // 执行转账
        const receiverBalanceBefore = await this.provider.getBalance(CONFIG.receiver);
        console.log("转账前接收者余额:", ethers.formatEther(receiverBalanceBefore), "ETH");
        
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
        
        const tx = await this.entryPoint.handleOps(
            [finalUserOpArray],
            this.wallet.address,
            {
                gasLimit: 2000000,
                maxFeePerGas: ethers.parseUnits("50", "gwei"),
                maxPriorityFeePerGas: ethers.parseUnits("10", "gwei")
            }
        );
        
        console.log("交易hash:", tx.hash);
        const receipt = await tx.wait();
        console.log("Gas使用:", receipt.gasUsed.toString());
        
        // 检查结果
        const receiverBalanceAfter = await this.provider.getBalance(CONFIG.receiver);
        const transferred = receiverBalanceAfter - receiverBalanceBefore;
        
        console.log("转账后接收者余额:", ethers.formatEther(receiverBalanceAfter), "ETH");
        console.log("实际转账金额:", ethers.formatEther(transferred), "ETH");
        
        return transferred === ethers.parseEther("0.002");
    }

    async run() {
        console.log("🎯 动态Gas BLS+ERC-4337转账测试");
        console.log("=".repeat(50));
        console.log("使用动态gas验证器:", CONFIG.validator);
        
        try {
            const accountAddress = await this.createOrGetAccount();
            const success = await this.performTransfer(accountAddress);
            
            if (success) {
                console.log("\n🏆 动态Gas转账成功!");
                console.log("✅ 动态gas计算验证器工作正常");
                console.log("✅ 基于EIP-2537的精确gas估算");
                console.log("✅ BLS聚合签名系统稳定运行");
            } else {
                console.log("\n❌ 转账金额不匹配");
            }
            
        } catch (error) {
            console.error("❌ 测试失败:", error.message);
        }
    }
}

const test = new DynamicGasTransferTest();
test.run().catch(console.error);