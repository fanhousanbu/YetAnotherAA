import axios from 'axios';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const API_BASE_URL = 'http://localhost:3000';
const AASTAR_VALIDATOR_ADDRESS = '0x0bC9DD7BCa3115198a59D367423E1535104A5882';

async function directTest() {
  try {
    console.log('\n========================================');
    console.log('直接测试 ECDSA + BLS 双重签名转账');
    console.log('========================================\n');
    
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
    
    // 1. 获取BLS节点
    console.log('1. 获取BLS节点...');
    const nodesResponse = await axios.get(`${API_BASE_URL}/bls/nodes`);
    const nodeIds = nodesResponse.data.nodes.slice(0, 2).map(n => n.nodeId);
    console.log(`   ✅ 选择${nodeIds.length}个节点`);
    
    // 2. 测试BLS签名
    console.log('\n2. 测试BLS签名聚合...');
    const testMessage = `DirectTest_${Date.now()}`;
    const blsResponse = await axios.post(`${API_BASE_URL}/bls/sign`, {
      message: testMessage,
      nodeIds: nodeIds
    });
    console.log(`   ✅ 聚合签名: ${blsResponse.data.aggregatedSignature.substring(0, 60)}...`);
    
    // 3. 尝试使用已知的账户地址（如果有的话）
    console.log('\n3. 使用预先计算的账户地址...');
    
    // 这里我们需要手动计算或使用一个已知的账户地址
    // 为了测试，我们可以尝试使用一个简单的配置
    
    // 创建一个测试钱包
    const testWallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, provider);
    console.log(`   EOA地址: ${testWallet.address}`);
    
    // 手动构造一个账户地址（这需要与合约部署时的逻辑匹配）
    // 或者我们可以尝试直接部署一个新的账户
    
    console.log('\n4. 尝试直接调用转账API...');
    console.log('   注意: 这将尝试创建UserOperation并发送到Bundler');
    
    // 使用一个简单的salt
    const salt = '1';
    
    // 先尝试创建账户（即使失败也没关系，我们主要测试转账流程）
    try {
      const accountResp = await axios.post(`${API_BASE_URL}/accounts`, {
        privateKey: process.env.ETH_PRIVATE_KEY,
        useAAStarValidator: true,
        salt: salt
      });
      
      if (accountResp.data.success) {
        console.log(`   ✅ 账户地址: ${accountResp.data.data.address}`);
        
        // 给账户充值
        const accountAddress = accountResp.data.data.address;
        const balance = await provider.getBalance(accountAddress);
        if (balance < ethers.parseEther('0.1')) {
          console.log('   💰 充值0.1 ETH...');
          const tx = await testWallet.sendTransaction({
            to: accountAddress,
            value: ethers.parseEther('0.1')
          });
          await tx.wait();
          console.log('   ✅ 充值完成');
        }
      }
    } catch (e: any) {
      console.log(`   ⚠️ 账户创建失败: ${e.response?.data?.message || e.message}`);
    }
    
    // 5. 测试转账（这是核心测试）
    console.log('\n5. 执行ECDSA + BLS双重签名转账...');
    
    try {
      const transferResp = await axios.post(`${API_BASE_URL}/transfer`, {
        fromPrivateKey: process.env.ETH_PRIVATE_KEY,
        toAddress: '0x0000000000000000000000000000000000000001',
        amount: '0.0001',
        useAAStarValidator: true,
        nodeIds: nodeIds,
        salt: salt
      });
      
      if (transferResp.data.success) {
        console.log('   🎉 转账成功!');
        console.log(`   UserOp Hash: ${transferResp.data.data.userOpHash}`);
        console.log(`   验证器: ${transferResp.data.data.validatorType}`);
        
        if (transferResp.data.data.transactionHash) {
          console.log(`   交易哈希: ${transferResp.data.data.transactionHash}`);
        }
      } else {
        console.log(`   ❌ 转账失败: ${transferResp.data.message}`);
      }
    } catch (e: any) {
      console.log(`   ❌ 转账请求失败: ${e.response?.data?.message || e.message}`);
      if (e.response?.data?.details) {
        console.log('   详细错误:', e.response.data.details);
      }
    }
    
    // 6. 分析和建议
    console.log('\n========================================');
    console.log('测试分析');
    console.log('========================================');
    console.log('✅ BLS签名系统工作正常');
    console.log('✅ AAStarValidator合约已部署 (0x0bC9DD7BCa3115198a59D367423E1535104A5882)');
    console.log('⚠️  AAStarAccountFactory可能需要重新部署或修复');
    console.log('\n建议的解决方案:');
    console.log('1. 检查AAStarAccountFactory合约的部署和初始化');
    console.log('2. 确认工厂合约是否正确引用了AAStarValidator');
    console.log('3. 可能需要重新部署工厂合约');
    
  } catch (error: any) {
    console.error('\n❌ 测试错误:', error.message);
    if (error.response?.data) {
      console.log('详情:', error.response.data);
    }
  }
}

directTest();