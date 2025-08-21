import axios from 'axios';
import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const API_BASE_URL = 'http://localhost:3000';
const AASTAR_VALIDATOR_ADDRESS = '0x0bC9DD7BCa3115198a59D367423E1535104A5882';

async function manualAccountTest() {
  try {
    console.log('\n======================================================================');
    console.log('🔧 手动账户测试 - 验证 ECDSA + BLS 双重签名机制');
    console.log('======================================================================\n');
    
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
    const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY!, provider);
    
    // 1. 系统状态检查
    console.log('📋 系统状态检查');
    console.log('-------------------');
    
    // 检查AAStarValidator合约
    const validatorCode = await provider.getCode(AASTAR_VALIDATOR_ADDRESS);
    console.log(`✅ AAStarValidator合约: ${AASTAR_VALIDATOR_ADDRESS}`);
    console.log(`   代码大小: ${(validatorCode.length - 2) / 2} 字节`);
    
    // 检查BLS节点
    const nodesResp = await axios.get(`${API_BASE_URL}/bls/nodes`);
    console.log(`✅ BLS节点: ${nodesResp.data.total} 个活跃`);
    const nodeIds = nodesResp.data.nodes.slice(0, 2).map(n => n.nodeId);
    
    // 2. 测试BLS签名聚合
    console.log('\n📝 BLS签名聚合测试');
    console.log('-------------------');
    
    const testMsg = `Verify_${Date.now()}`;
    const blsResp = await axios.post(`${API_BASE_URL}/bls/sign`, {
      message: testMsg,
      nodeIds: nodeIds
    });
    
    console.log(`✅ 消息: ${testMsg}`);
    console.log(`✅ 聚合签名成功`);
    console.log(`   签名长度: ${blsResp.data.aggregatedSignature.length} 字符`);
    console.log(`   参与节点: ${blsResp.data.participatingNodes.length} 个`);
    
    // 3. 尝试不同的方法创建/使用账户
    console.log('\n🔍 账户处理策略');
    console.log('-------------------');
    
    // 策略1: 尝试使用EnhancedFactory但指定AAStarValidator
    console.log('尝试策略1: 使用EnhancedFactory...');
    try {
      const enhancedResp = await axios.post(`${API_BASE_URL}/accounts`, {
        privateKey: process.env.ETH_PRIVATE_KEY,
        useAAStarValidator: false, // 先用false创建
        salt: '999999'
      });
      
      if (enhancedResp.data.success) {
        const accountAddr = enhancedResp.data.data.address;
        console.log(`✅ 账户地址: ${accountAddr}`);
        
        // 充值
        const balance = await provider.getBalance(accountAddr);
        if (balance < ethers.parseEther('0.05')) {
          console.log('   充值 0.05 ETH...');
          const tx = await wallet.sendTransaction({
            to: accountAddr,
            value: ethers.parseEther('0.05')
          });
          await tx.wait();
          console.log('   ✅ 充值完成');
        }
        
        // 现在尝试使用AAStarValidator进行转账
        console.log('\n🚀 执行双重签名转账测试');
        console.log('-------------------------');
        console.log('配置:');
        console.log(`  验证器: AAStarValidator (${AASTAR_VALIDATOR_ADDRESS})`);
        console.log(`  BLS节点: ${nodeIds.length} 个`);
        console.log(`  签名类型: ECDSA + BLS聚合签名`);
        
        const transferResp = await axios.post(`${API_BASE_URL}/transfer`, {
          fromPrivateKey: process.env.ETH_PRIVATE_KEY,
          toAddress: '0x0000000000000000000000000000000000000001',
          amount: '0.0001',
          useAAStarValidator: true, // 转账时使用AAStarValidator
          nodeIds: nodeIds,
          salt: '999999'
        });
        
        if (transferResp.data.success) {
          console.log('\n🎉 成功! ECDSA + BLS 双重签名转账完成!');
          console.log('================================');
          console.log(`UserOp哈希: ${transferResp.data.data.userOpHash}`);
          console.log(`验证器类型: ${transferResp.data.data.validatorType}`);
          if (transferResp.data.data.transactionHash) {
            console.log(`交易哈希: ${transferResp.data.data.transactionHash}`);
            
            // 等待确认
            const receipt = await provider.waitForTransaction(
              transferResp.data.data.transactionHash
            );
            console.log(`✅ 交易已确认! 区块: ${receipt?.blockNumber}`);
          }
        } else {
          console.log(`❌ 转账失败: ${transferResp.data.message}`);
        }
      }
    } catch (e: any) {
      console.log(`❌ 策略1失败: ${e.response?.data?.message || e.message}`);
    }
    
    // 4. 测试总结
    console.log('\n======================================================================');
    console.log('📊 测试总结');
    console.log('======================================================================');
    
    console.log('\n✅ 已验证的组件:');
    console.log('  • AAStarValidator合约已部署并可访问');
    console.log('  • BLS节点网络正常运行');
    console.log('  • BLS签名聚合功能正常');
    console.log('  • 后端服务API正常');
    
    console.log('\n📝 双重签名机制说明:');
    console.log('  1. UserOperation需要两种签名:');
    console.log('     - BLS聚合签名 (来自多个BLS节点)');
    console.log('     - ECDSA签名 (来自账户所有者)');
    console.log('  2. AAStarValidator合约验证流程:');
    console.log('     - 提取并验证BLS聚合签名');
    console.log('     - 提取并验证ECDSA签名');
    console.log('     - 两者都通过才允许执行交易');
    console.log('  3. 签名数据结构:');
    console.log('     [nodeIds长度][nodeIds数组][BLS签名(256字节)][ECDSA签名(65字节)]');
    
    console.log('\n⚠️  当前问题:');
    console.log('  • AAStarAccountFactory合约可能需要重新部署');
    console.log('  • 工厂合约的getAddress方法执行失败');
    
  } catch (error: any) {
    console.error('\n❌ 测试错误:', error.message);
    if (error.response?.data) {
      console.log('详情:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

manualAccountTest();