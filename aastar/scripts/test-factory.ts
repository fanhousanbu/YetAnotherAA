import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function testFactory() {
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
  
  // AAStarAccountFactory
  const aastarFactoryAddress = process.env.AASTAR_ACCOUNT_FACTORY_ADDRESS;
  const validatorAddress = process.env.VALIDATOR_CONTRACT_ADDRESS;
  
  console.log('测试AAStarAccountFactory:');
  console.log('工厂地址:', aastarFactoryAddress);
  console.log('验证器地址:', validatorAddress);
  
  // 测试参数
  const testWallet = ethers.Wallet.createRandom();
  const ownerAddress = testWallet.address;
  const salt = '200';
  
  console.log('测试钱包地址:', ownerAddress);
  console.log('Salt:', salt);
  
  // 创建工厂合约实例
  const factoryAbi = [
    'function getAddress(address owner, address validator, bool useCustomValidator, uint256 salt) view returns (address)',
    'function createAccount(address owner, address validator, bool useCustomValidator, uint256 salt) returns (address)',
  ];
  
  const factory = new ethers.Contract(
    aastarFactoryAddress!,
    factoryAbi,
    provider
  );
  
  try {
    // 测试getAddress调用
    console.log('\n尝试调用getAddress...');
    const predictedAddress = await factory['getAddress(address,address,bool,uint256)'](
      ownerAddress,
      validatorAddress,
      true,  // useCustomValidator
      salt
    );
    console.log('✅ 预计算地址成功:', predictedAddress);
    
    // 检查该地址是否已部署
    const code = await provider.getCode(predictedAddress);
    console.log('账户部署状态:', code !== '0x' ? '已部署' : '未部署');
    
  } catch (error: any) {
    console.error('❌ 调用失败:', error.message);
    if (error.data) {
      console.error('错误数据:', error.data);
    }
  }
  
  // 测试EnhancedFactory
  console.log('\n\n测试EnhancedFactory:');
  const enhancedFactoryAddress = process.env.ENHANCED_FACTORY_ADDRESS;
  console.log('工厂地址:', enhancedFactoryAddress);
  
  const enhancedFactoryAbi = [
    'function getAddress(address owner, uint256 salt) view returns (address)',
  ];
  
  const enhancedFactory = new ethers.Contract(
    enhancedFactoryAddress!,
    enhancedFactoryAbi,
    provider
  );
  
  try {
    const ecdsaAddress = await enhancedFactory['getAddress(address,uint256)'](ownerAddress, salt);
    console.log('✅ ECDSA账户地址:', ecdsaAddress);
  } catch (error: any) {
    console.error('❌ 调用失败:', error.message);
  }
}

testFactory().catch(console.error);