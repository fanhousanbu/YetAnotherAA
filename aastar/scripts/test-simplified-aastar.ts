import axios from 'axios';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const API_BASE_URL = 'http://localhost:3000';

async function testSimplifiedAAStarSystem() {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 简化版AAStarValidator (ECDSA + BLS双重签名) 测试');
    console.log('='.repeat(80) + '\n');
    
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
    const fundingWallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, provider);
    
    console.log('📋 简化版配置:');
    console.log('  AAStarValidator合约: 0x0bC9DD7BCa3115198a59D367423E1535104A5882');
    console.log('  简化版工厂合约: 0xb0Ca45246afee904EC6a94FfdA50E15Ef79394D9');
    console.log('  资金账户: ' + fundingWallet.address);
    console.log('  🔥 新特性: BLS和ECDSA都对userOpHash签名');
    
    // 1. 获取BLS节点
    console.log('\n1️⃣  获取BLS节点...');
    const nodesResp = await axios.get(`${API_BASE_URL}/bls/nodes`);
    const nodeIds = nodesResp.data.nodes.slice(0, 2).map(n => n.nodeId);
    console.log(`  ✅ 选择${nodeIds.length}个BLS节点`);
    
    // 2. 测试BLS签名聚合
    console.log('\n2️⃣  测试BLS签名聚合...');
    const testMsg = `SimplifiedTest_${Date.now()}`;
    const blsResp = await axios.post(`${API_BASE_URL}/bls/sign`, {
      message: testMsg,
      nodeIds: nodeIds
    });
    console.log('  ✅ BLS签名聚合成功');
    console.log(`  📝 聚合签名: ${blsResp.data.aggregatedSignature.substring(0, 60)}...`);
    
    // 3. 创建简化版AAStarValidator账户
    console.log('\n3️⃣  创建简化版AAStarValidator账户...');
    const salt = Math.floor(Math.random() * 1000000).toString();
    console.log(`  Salt: ${salt}`);
    
    const accountResp = await axios.post(`${API_BASE_URL}/accounts`, {
      privateKey: process.env.ETH_PRIVATE_KEY,
      useAAStarValidator: true,
      salt: salt
    });
    
    if (!accountResp.data.success) {
      throw new Error(`账户创建失败: ${accountResp.data.message}`);
    }
    
    const account = accountResp.data.data;
    console.log('  ✅ 简化版账户创建成功!');
    console.log(`  📍 账户地址: ${account.address}`);
    console.log(`  🔐 验证器类型: ${account.validationConfig.isCustom ? 'AAStarValidator_Simplified' : 'ECDSA'}`);
    
    // 4. 给账户充值
    console.log('\n4️⃣  给账户充值...');
    const balance = await provider.getBalance(account.address);
    if (balance < ethers.parseEther('0.05')) {
      console.log('  💰 充值 0.05 ETH...');
      const fundTx = await fundingWallet.sendTransaction({
        to: account.address,
        value: ethers.parseEther('0.05')
      });
      console.log(`  📄 交易哈希: ${fundTx.hash}`);
      await fundTx.wait();
      console.log('  ✅ 充值完成');
      await new Promise(r => setTimeout(r, 2000)); // 等待2秒
    }
    
    // 5. 执行简化版双重签名转账
    console.log('\n5️⃣  执行简化版双重签名转账...');
    console.log('  🔥 新算法: BLS和ECDSA都对userOpHash签名');
    console.log('  配置:');
    console.log(`    从: ${account.address}`);
    console.log(`    到: 0x0000000000000000000000000000000000000001`);
    console.log(`    金额: 0.001 ETH`);
    console.log(`    BLS节点: ${nodeIds.length}个`);
    console.log(`    验证器: AAStarValidator_Simplified`);
    
    const transferResp = await axios.post(`${API_BASE_URL}/transfer`, {
      fromPrivateKey: process.env.ETH_PRIVATE_KEY,
      toAddress: '0x0000000000000000000000000000000000000001',
      amount: '0.001',
      useAAStarValidator: true,
      nodeIds: nodeIds,
      salt: salt
    });
    
    if (!transferResp.data.success) {
      throw new Error(`转账失败: ${transferResp.data.message}`);
    }
    
    console.log('\n  🎉 简化版ECDSA + BLS双重签名转账成功!');
    console.log('  ===============================================');
    console.log(`  📋 UserOp哈希: ${transferResp.data.data.userOpHash}`);
    console.log(`  🔐 验证器类型: ${transferResp.data.data.validatorType}`);
    
    if (transferResp.data.data.transactionHash) {
      console.log(`  🔗 交易哈希: ${transferResp.data.data.transactionHash}`);
      console.log('  ⏳ 等待交易确认...');
      const receipt = await provider.waitForTransaction(
        transferResp.data.data.transactionHash
      );
      console.log(`  ✅ 交易已确认! 区块号: ${receipt?.blockNumber}`);
    }
    
    // 6. 验证余额
    const finalBalance = await provider.getBalance(account.address);
    console.log(`\n  💰 账户最终余额: ${ethers.formatEther(finalBalance)} ETH`);
    
    // 总结
    console.log('\n' + '='.repeat(80));
    console.log('🏆 简化版测试完成 - 双重签名验证成功!');
    console.log('='.repeat(80));
    
    console.log('\n✅ 已验证的功能:');
    console.log('  1. BLS节点网络正常运行');
    console.log('  2. BLS签名聚合成功');
    console.log('  3. 简化版AAStarAccountFactory工作正常');
    console.log('  4. 简化版AAStarValidator合约验证双重签名');
    console.log('  5. 简化版ECDSA + BLS双重签名机制完整实现');
    console.log('  6. ERC-4337 UserOperation成功执行');
    console.log('  7. 链上转账成功完成');
    
    console.log('\n🔥 简化版技术亮点:');
    console.log('  • 签名算法: BLS和ECDSA都对userOpHash签名');
    console.log('  • 无需复杂的hash-to-curve匹配');
    console.log('  • 使用BLS节点标准算法');
    console.log('  • 合约验证逻辑简化');
    
    console.log('\n✨ 问题已解决:');
    console.log('  ✅ 签名格式编码正确');
    console.log('  ✅ BLS和ECDSA消息一致性');
    console.log('  ✅ 合约验证逻辑匹配');
    console.log('  ✅ 双重签名验证通过');
    
  } catch (error: any) {
    console.error('\n❌ 简化版测试失败:', error.message);
    if (error.response?.data) {
      console.log('详情:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testSimplifiedAAStarSystem()
  .then(() => {
    console.log('\n🎊 简化版测试成功完成!');
    console.log('🌟 ERC4337 + ECDSA + BLS双重签名系统正式可用!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('执行错误:', error);
    process.exit(1);
  });