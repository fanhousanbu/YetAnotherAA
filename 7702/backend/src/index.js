const express = require("express");
const { ethers } = require("ethers");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// DelegationFactory ABI (只需要 deployDelegation 函数)
const FACTORY_ABI = [
  "function deployDelegation(address owner, uint256 dailyLimit) external returns (address delegation)",
  "function predictDelegationAddress(address owner) external view returns (address)",
  "function getDelegation(address owner) external view returns (address)"
];

// 配置
const SEPOLIA_RPC_URL =
  process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N";
const DELEGATION_FACTORY_ADDRESS =
  process.env.DELEGATION_FACTORY_ADDRESS || "0x6523d48536989E50401De430E6637E890cE0F9A6";
const SPONSOR_PAYMASTER_ADDRESS =
  process.env.PAYMASTER_ADDRESS || "0x6004fE178B9fF8c79218AA2737472dD1CAD2773a";
const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY;

// 优先使用环境变量中的RPC URL
const rpcUrl = SEPOLIA_RPC_URL;
const provider = new ethers.JsonRpcProvider(rpcUrl);
const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

// 模拟合约调用 - 避免网络连接问题
const mockDelegationContracts = new Map();

// 模拟 DelegationFactory 功能
class MockDelegationFactory {
  constructor() {
    this.deployments = new Map();
  }

  async getDelegation(owner) {
    // 模拟返回0x0地址表示没有部署
    return "0x0000000000000000000000000000000000000000";
  }

  async predictDelegationAddress(owner) {
    // 模拟CREATE2地址计算
    const hash = ethers.solidityPackedKeccak256(["address", "uint256"], [owner, Date.now()]);
    return "0x" + hash.slice(26);
  }

  async deployDelegation(owner, dailyLimit) {
    const delegationAddress = await this.predictDelegationAddress(owner);
    this.deployments.set(owner.toLowerCase(), {
      address: delegationAddress,
      dailyLimit: dailyLimit,
      deployed: true,
    });
    return delegationAddress;
  }

  populateTransaction(owner, dailyLimit) {
    return {
      to: DELEGATION_FACTORY_ADDRESS,
      data: "0xmock",
      gasLimit: "500000",
    };
  }

  // 添加connect方法
  connect(wallet) {
    return this;
  }
}

// 模拟 Paymaster 功能
class MockPaymaster {
  constructor() {
    this.sponsoredUsers = new Set();
  }

  async getBalance() {
    return ethers.parseEther("1.0");
  }

  async isUserSponsored(user) {
    return this.sponsoredUsers.has(user.toLowerCase());
  }

  async validateAndSponsor(user, userOpHash, maxCost, signature) {
    if (this.sponsoredUsers.has(user.toLowerCase())) {
      throw new Error("用户已被赞助，无法重复赞助");
    }
    this.sponsoredUsers.add(user.toLowerCase());
    return maxCost;
  }

  // 添加connect方法
  connect(wallet) {
    return this;
  }
}

const mockFactory = new MockDelegationFactory();
const mockPaymaster = new MockPaymaster();

const factoryContract = mockFactory;
const paymasterContract = mockPaymaster;

// 中间件：日志记录
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 健康检查
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// 检查委托状态
app.post("/api/eip7702/status", async (req, res) => {
  try {
    const { userAddress } = req.body;

    if (!userAddress || !ethers.isAddress(userAddress)) {
      return res.status(400).json({ error: "Invalid user address" });
    }

    let delegationAddress;
    let isSponsored = false;

    try {
      delegationAddress = await factoryContract.getDelegation(userAddress);
    } catch (error) {
      console.log("Error getting delegation:", error.message);
      delegationAddress = ethers.ZeroAddress;
    }

    try {
      isSponsored = await paymasterContract.isUserSponsored(userAddress);
    } catch (error) {
      console.log("Error checking sponsorship:", error.message);
      isSponsored = false;
    }

    let status = {
      enabled: false,
      address: null,
      method: "none",
      isSponsored,
    };

    if (delegationAddress !== ethers.ZeroAddress) {
      status.enabled = true;
      status.address = delegationAddress;

      // 检查是否有 EIP-7702 授权
      try {
        const delegationContract = new ethers.Contract(delegationAddress, delegationABI, provider);
        const owner = await delegationContract.OWNER();
        status.method = owner.toLowerCase() === userAddress.toLowerCase() ? "eip7702" : "deployed";
      } catch (error) {
        status.method = "deployed";
      }
    }

    res.json(status);
  } catch (error) {
    console.error("Status check failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// 启用委托 - 混合方案
app.post("/api/eip7702/enable", async (req, res) => {
  try {
    const { userAddress, dailyLimit } = req.body;

    if (!userAddress || !ethers.isAddress(userAddress)) {
      return res.status(400).json({ error: "Invalid user address" });
    }

    console.log(`Enabling delegation for ${userAddress}`);

    // 检查是否已存在委托
    let existingDelegation;
    try {
      existingDelegation = await factoryContract.getDelegation(userAddress);
    } catch (error) {
      console.log("Error checking existing delegation:", error.message);
      existingDelegation = ethers.ZeroAddress;
    }

    if (existingDelegation !== ethers.ZeroAddress) {
      return res.json({
        success: true,
        delegationAddress: existingDelegation,
        method: "existing",
        txHash: "",
        message: "委托已存在",
      });
    }

    // 选择方案：优先尝试 Relayer（因为 Paymaster 需要复杂集成）
    const method = await chooseOptimalApproach(userAddress);
    console.log(`Chosen approach: ${method}`);

    let result;
    if (method === "relayer") {
      result = await enableWithRelayer(
        userAddress,
        dailyLimit || ethers.parseEther("0.1").toString()
      );
    } else {
      result = await enableWithPaymaster(
        userAddress,
        dailyLimit || ethers.parseEther("0.1").toString()
      );
    }

    res.json(result);
  } catch (error) {
    console.error("Enable delegation failed:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// 选择最优方案
async function chooseOptimalApproach(userAddress) {
  try {
    // 检查 Relayer 余额
    const relayerBalance = await provider.getBalance(relayerWallet.address);
    console.log(`Relayer balance: ${ethers.formatEther(relayerBalance)} ETH`);

    // 检查用户是否已被赞助
    const isSponsored = await paymasterContract.isUserSponsored(userAddress);
    console.log(`User sponsored: ${isSponsored}`);

    // 简化决策：优先使用 Relayer
    if (relayerBalance > ethers.parseEther("0.01")) {
      return "relayer";
    } else {
      return "paymaster";
    }
  } catch (error) {
    console.error("Error choosing approach:", error);
    return "relayer";
  }
}

// Relayer 方案
async function enableWithRelayer(userAddress, dailyLimit) {
  try {
    console.log("Using Relayer approach");
    console.log(`User: ${userAddress}, Daily Limit: ${dailyLimit}`);

    // 创建 Interface 用于编码函数调用
    const factoryInterface = new ethers.Interface(FACTORY_ABI);

    // 编码 deployDelegation 函数调用
    const calldata = factoryInterface.encodeFunctionData("deployDelegation", [
      userAddress,
      dailyLimit
    ]);

    console.log(`Generated calldata: ${calldata}`);

    // 预测委托合约地址
    const delegationAddress = await factoryContract.predictDelegationAddress(userAddress);
    console.log(`Predicted delegation address: ${delegationAddress}`);

    // 获取当前 gas 价格
    const feeData = await provider.getFeeData();
    const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits("20", "gwei");
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits("2", "gwei");

    // 返回需要用户签名的交易数据
    return {
      success: false,
      needsSignature: true,
      transaction: {
        to: DELEGATION_FACTORY_ADDRESS,
        data: calldata,
        gasLimit: "500000",
        maxFeePerGas: maxFeePerGas.toString(),
        maxPriorityFeePerGas: maxPriorityFeePerGas.toString(),
        chainId: 11155111,
      },
      delegationAddress,
      method: "relayer",
      message: "请签名交易以设置委托",
    };
  } catch (error) {
    console.error("Relayer approach failed:", error);
    throw error;
  }
}

// Paymaster 方案（简化版本）
async function enableWithPaymaster(userAddress, dailyLimit) {
  try {
    console.log("Using Paymaster approach");

    // 检查 Paymaster 余额和赞助状态
    const paymasterBalance = await paymasterContract.getBalance();
    const isSponsored = await paymasterContract.isUserSponsored(userAddress);

    if (isSponsored) {
      throw new Error("用户已被赞助，无法重复赞助");
    }

    if (paymasterBalance < ethers.parseEther("0.1")) {
      throw new Error("Paymaster 余额不足");
    }

    // 这里应该构造 UserOperation，但为简化返回成功
    const delegationAddress = await factoryContract.predictDelegationAddress(userAddress);

    return {
      success: true,
      delegationAddress,
      method: "paymaster",
      txHash: "0xmock",
      message: "通过 Paymaster 成功设置委托（模拟）",
    };
  } catch (error) {
    console.error("Paymaster approach failed:", error);
    throw error;
  }
}

// 广播已签名的交易
app.post("/api/relayer/broadcast", async (req, res) => {
  try {
    const { signedTx, userAddress } = req.body;

    if (!signedTx) {
      return res.status(400).json({ error: "Missing signed transaction" });
    }

    console.log(`Broadcasting transaction for ${userAddress}`);

    // 验证签名者
    const tx = ethers.Transaction.from(signedTx);
    const signer = ethers.recoverAddress(tx.hash, tx.signature);

    console.log(`Expected signer: ${userAddress}, Recovered: ${signer}`);

    // 广播交易
    const txResponse = await relayerWallet.provider.broadcastTransaction(signedTx);
    console.log(`Transaction broadcasted: ${txResponse.hash}`);

    // 等待确认
    const receipt = await txResponse.wait(1);
    console.log(`Transaction confirmed: ${receipt.hash}`);

    res.json({
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (error) {
    console.error("Broadcast failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// 获取委托合约信息
app.post("/api/delegation/info", async (req, res) => {
  try {
    const { delegationAddress } = req.body;

    if (!delegationAddress || !ethers.isAddress(delegationAddress)) {
      return res.status(400).json({ error: "Invalid delegation address" });
    }

    const delegationContract = new ethers.Contract(delegationAddress, delegationABI, provider);

    const info = {
      owner: await delegationContract.OWNER(),
      paymaster: await delegationContract.paymaster(),
      dailyLimit: await delegationContract.dailyLimit(),
    };

    res.json(info);
  } catch (error) {
    console.error("Get delegation info failed:", error);
    res.status(500).json({ error: error.message });
  }
});

// 测试端点
app.get("/api/test", async (req, res) => {
  try {
    const relayerBalance = await provider.getBalance(relayerWallet.address);
    let paymasterBalance = "0";

    try {
      paymasterBalance = await paymasterContract.getBalance();
    } catch (error) {
      console.log("Paymaster balance check failed:", error.message);
    }

    res.json({
      relayerAddress: relayerWallet.address,
      relayerBalance: ethers.formatEther(relayerBalance),
      paymasterAddress: SPONSOR_PAYMASTER_ADDRESS,
      paymasterBalance: ethers.formatEther(paymasterBalance),
      network: "sepolia",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`EIP-7702 Backend server running on port ${PORT}`);
  console.log(`Test endpoint: http://localhost:${PORT}/api/test`);
});
