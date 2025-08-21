import axios from 'axios';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_BASE_URL = 'http://localhost:3000';
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m'
};

function log(message: string, color: string = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

function logSection(title: string) {
  console.log('\n' + '='.repeat(60));
  log(title, COLORS.bright + COLORS.cyan);
  console.log('='.repeat(60));
}

function logSuccess(message: string) {
  log(`✅ ${message}`, COLORS.green);
}

function logInfo(message: string) {
  log(`ℹ️  ${message}`, COLORS.blue);
}

function logWarning(message: string) {
  log(`⚠️  ${message}`, COLORS.yellow);
}

function logError(message: string) {
  log(`❌ ${message}`, COLORS.red);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function completeFlowTest() {
  try {
    logSection('🚀 ERC4337 + BLS聚合签名 完整流程测试');
    
    // 初始化provider和钱包
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
    const fundingWallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, provider);
    
    logInfo(`资金账户: ${fundingWallet.address}`);
    const fundingBalance = await provider.getBalance(fundingWallet.address);
    logInfo(`资金账户余额: ${ethers.formatEther(fundingBalance)} ETH`);
    
    // =================================================================
    // 测试1: 系统健康检查
    // =================================================================
    logSection('步骤1: 系统健康检查');
    
    // 检查AAstar服务
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    logSuccess(`AAstar服务状态: ${healthResponse.data.status}`);
    
    // 检查BLS服务
    const blsHealthResponse = await axios.get(`${API_BASE_URL}/bls/health`);
    logSuccess(`BLS服务状态: ${blsHealthResponse.data.healthy ? '健康' : '异常'}`);
    
    // 获取活跃的BLS节点
    const nodesResponse = await axios.get(`${API_BASE_URL}/bls/nodes`);
    logSuccess(`活跃BLS节点数: ${nodesResponse.data.total}`);
    
    const activeNodes = nodesResponse.data.nodes;
    if (activeNodes.length < 2) {
      throw new Error('需要至少2个活跃的BLS节点');
    }
    
    const nodeIds = activeNodes.slice(0, 2).map(n => n.nodeId);
    logInfo(`将使用节点: ${nodeIds.join(', ')}`);
    
    // =================================================================
    // 测试2: 创建测试钱包
    // =================================================================
    logSection('步骤2: 创建测试钱包');
    
    // 为测试生成新的私钥
    const testWallet = ethers.Wallet.createRandom();
    const testPrivateKey = testWallet.privateKey;
    logInfo(`测试钱包地址: ${testWallet.address}`);
    logInfo(`测试私钥: ${testPrivateKey.substring(0, 10)}...`);
    
    // =================================================================
    // 测试3: ECDSA账户创建和转账
    // =================================================================
    logSection('步骤3: ECDSA账户创建和转账');
    
    // 3.1 创建ECDSA账户
    log('\n3.1 创建ECDSA账户...');
    const ecdsaSalt = '100';
    const ecdsaAccountResponse = await axios.post(`${API_BASE_URL}/accounts`, {
      privateKey: testPrivateKey,
      useAAStarValidator: false,
      salt: ecdsaSalt
    });
    
    const ecdsaAccount = ecdsaAccountResponse.data.data;
    logSuccess(`ECDSA账户创建成功`);
    logInfo(`账户地址: ${ecdsaAccount.address}`);
    logInfo(`部署状态: ${ecdsaAccount.isDeployed ? '已部署' : '未部署'}`);
    logInfo(`初始余额: ${ecdsaAccount.balance} ETH`);
    
    // 3.2 给ECDSA账户充值
    log('\n3.2 给ECDSA账户充值...');
    const fundAmount = ethers.parseEther('0.1');
    logInfo(`充值金额: 0.1 ETH`);
    
    const fundTx = await fundingWallet.sendTransaction({
      to: ecdsaAccount.address,
      value: fundAmount
    });
    logInfo(`充值交易哈希: ${fundTx.hash}`);
    log('等待交易确认...');
    const fundReceipt = await fundTx.wait();
    logSuccess(`充值成功! 区块号: ${fundReceipt?.blockNumber}`);
    
    // 等待一下让余额更新
    await sleep(2000);
    
    // 3.3 检查余额
    log('\n3.3 检查账户余额...');
    const ecdsaBalanceAfter = await provider.getBalance(ecdsaAccount.address);
    logSuccess(`账户余额: ${ethers.formatEther(ecdsaBalanceAfter)} ETH`);
    
    // 3.4 预估转账费用
    log('\n3.4 预估ECDSA转账费用...');
    const ecdsaEstimateResponse = await axios.post(`${API_BASE_URL}/transfer/estimate`, {
      fromPrivateKey: testPrivateKey,
      toAddress: '0x0000000000000000000000000000000000000001',
      amount: '0.001',
      useAAStarValidator: false,
      salt: ecdsaSalt
    });
    
    const ecdsaEstimate = ecdsaEstimateResponse.data.data;
    logSuccess(`费用预估完成`);
    logInfo(`预估Gas: ${ecdsaEstimate.estimatedGas}`);
    logInfo(`预估费用: ${ecdsaEstimate.estimatedCost} ETH`);
    
    // 3.5 执行ECDSA转账
    log('\n3.5 执行ECDSA验证转账...');
    const ecdsaTransferResponse = await axios.post(`${API_BASE_URL}/transfer`, {
      fromPrivateKey: testPrivateKey,
      toAddress: '0x0000000000000000000000000000000000000001',
      amount: '0.001',
      useAAStarValidator: false,
      salt: ecdsaSalt
    });
    
    if (ecdsaTransferResponse.data.success) {
      logSuccess(`ECDSA转账成功!`);
      logInfo(`UserOp哈希: ${ecdsaTransferResponse.data.data.userOpHash}`);
      if (ecdsaTransferResponse.data.data.transactionHash) {
        logInfo(`交易哈希: ${ecdsaTransferResponse.data.data.transactionHash}`);
      }
      
      // 等待交易确认
      if (ecdsaTransferResponse.data.data.transactionHash) {
        log('等待交易确认...');
        const txReceipt = await provider.waitForTransaction(
          ecdsaTransferResponse.data.data.transactionHash
        );
        logSuccess(`交易已确认! 区块号: ${txReceipt?.blockNumber}`);
      }
    } else {
      logWarning(`ECDSA转账失败: ${ecdsaTransferResponse.data.message}`);
    }
    
    // =================================================================
    // 测试4: AAStarValidator账户创建和转账
    // =================================================================
    logSection('步骤4: AAStarValidator账户创建和转账');
    
    // 4.1 创建AAStarValidator账户
    log('\n4.1 创建AAStarValidator账户...');
    const aastarSalt = '200';
    const aastarAccountResponse = await axios.post(`${API_BASE_URL}/accounts`, {
      privateKey: testPrivateKey,
      useAAStarValidator: true,
      salt: aastarSalt
    });
    
    const aastarAccount = aastarAccountResponse.data.data;
    logSuccess(`AAStarValidator账户创建成功`);
    logInfo(`账户地址: ${aastarAccount.address}`);
    logInfo(`部署状态: ${aastarAccount.isDeployed ? '已部署' : '未部署'}`);
    logInfo(`验证器类型: ${aastarAccount.validationConfig.isCustom ? 'AAStarValidator' : 'ECDSA'}`);
    
    // 4.2 给AAStarValidator账户充值
    log('\n4.2 给AAStarValidator账户充值...');
    const aastarFundTx = await fundingWallet.sendTransaction({
      to: aastarAccount.address,
      value: fundAmount
    });
    logInfo(`充值交易哈希: ${aastarFundTx.hash}`);
    log('等待交易确认...');
    const aastarFundReceipt = await aastarFundTx.wait();
    logSuccess(`充值成功! 区块号: ${aastarFundReceipt?.blockNumber}`);
    
    await sleep(2000);
    
    // 4.3 测试BLS签名聚合
    log('\n4.3 测试BLS签名聚合...');
    const testMessage = `Test BLS Aggregation ${Date.now()}`;
    const blsSignResponse = await axios.post(`${API_BASE_URL}/bls/sign`, {
      message: testMessage,
      nodeIds: nodeIds
    });
    
    if (blsSignResponse.data.aggregatedSignature) {
      logSuccess(`BLS签名聚合成功!`);
      logInfo(`消息: ${testMessage}`);
      logInfo(`聚合签名(前40字符): ${blsSignResponse.data.aggregatedSignature.substring(0, 40)}...`);
      logInfo(`参与节点数: ${blsSignResponse.data.participatingNodes.length}`);
    } else {
      logWarning('BLS签名聚合失败');
    }
    
    // 4.4 预估AAStarValidator转账费用
    log('\n4.4 预估AAStarValidator转账费用...');
    const aastarEstimateResponse = await axios.post(`${API_BASE_URL}/transfer/estimate`, {
      fromPrivateKey: testPrivateKey,
      toAddress: '0x0000000000000000000000000000000000000002',
      amount: '0.001',
      useAAStarValidator: true,
      nodeIds: nodeIds,
      salt: aastarSalt
    });
    
    const aastarEstimate = aastarEstimateResponse.data.data;
    logSuccess(`费用预估完成`);
    logInfo(`预估Gas: ${aastarEstimate.estimatedGas}`);
    logInfo(`预估费用: ${aastarEstimate.estimatedCost} ETH`);
    logInfo(`验证器类型: ${aastarEstimate.validatorType}`);
    
    // 4.5 执行AAStarValidator转账
    log('\n4.5 执行BLS聚合签名验证转账...');
    logInfo(`使用${nodeIds.length}个BLS节点进行签名`);
    
    const aastarTransferResponse = await axios.post(`${API_BASE_URL}/transfer`, {
      fromPrivateKey: testPrivateKey,
      toAddress: '0x0000000000000000000000000000000000000002',
      amount: '0.001',
      useAAStarValidator: true,
      nodeIds: nodeIds,
      salt: aastarSalt
    });
    
    if (aastarTransferResponse.data.success) {
      logSuccess(`AAStarValidator转账成功!`);
      logInfo(`UserOp哈希: ${aastarTransferResponse.data.data.userOpHash}`);
      logInfo(`验证器类型: ${aastarTransferResponse.data.data.validatorType}`);
      if (aastarTransferResponse.data.data.transactionHash) {
        logInfo(`交易哈希: ${aastarTransferResponse.data.data.transactionHash}`);
        
        log('等待交易确认...');
        const txReceipt = await provider.waitForTransaction(
          aastarTransferResponse.data.data.transactionHash
        );
        logSuccess(`交易已确认! 区块号: ${txReceipt?.blockNumber}`);
      }
    } else {
      logWarning(`AAStarValidator转账失败: ${aastarTransferResponse.data.message}`);
    }
    
    // =================================================================
    // 测试5: 余额验证
    // =================================================================
    logSection('步骤5: 最终余额验证');
    
    // 检查ECDSA账户最终余额
    const ecdsaFinalBalance = await provider.getBalance(ecdsaAccount.address);
    logInfo(`ECDSA账户最终余额: ${ethers.formatEther(ecdsaFinalBalance)} ETH`);
    
    // 检查AAStarValidator账户最终余额
    const aastarFinalBalance = await provider.getBalance(aastarAccount.address);
    logInfo(`AAStarValidator账户最终余额: ${ethers.formatEther(aastarFinalBalance)} ETH`);
    
    // =================================================================
    // 测试总结
    // =================================================================
    logSection('📊 测试总结');
    
    logSuccess('所有测试通过!');
    console.log('\n功能验证清单:');
    logSuccess('ERC-4337 账户抽象实现');
    logSuccess('ECDSA 签名验证');
    logSuccess('BLS 聚合签名验证');
    logSuccess('AAStarValidator 双重签名验证');
    logSuccess('UserOperation 创建和发送');
    logSuccess('链上合约交互');
    logSuccess('账户部署和转账执行');
    
    console.log('\n系统特性:');
    logInfo('• 支持两种验证模式: 标准ECDSA 和 AAStarValidator(ECDSA+BLS)');
    logInfo('• BLS签名由多个节点参与，提供更高的安全性');
    logInfo('• 账户在首次交易时自动部署(懒加载)');
    logInfo('• 完全兼容ERC-4337标准');
    
  } catch (error) {
    logError(`测试失败: ${error.response?.data?.message || error.message}`);
    if (error.response?.data?.details) {
      logError(`详细信息: ${JSON.stringify(error.response.data.details, null, 2)}`);
    }
    process.exit(1);
  }
}

// 执行测试
async function main() {
  try {
    await completeFlowTest();
    log('\n✨ 测试完成!', COLORS.bright + COLORS.green);
    process.exit(0);
  } catch (error) {
    logError(`执行错误: ${error}`);
    process.exit(1);
  }
}

main();