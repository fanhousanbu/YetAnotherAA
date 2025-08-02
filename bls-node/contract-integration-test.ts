import { generateAggregateSignature } from './src/signature';
import { toSolidityArguments } from './src/common/utils';
import { ethers } from 'ethers';
import { SecretKey } from '@chainsafe/blst';

// 合约配置
const CONTRACT_ADDRESS = '0x2c7d42a4a1f61c53195a1852bfe3281a2f2e9450';
const RPC_URL = 'https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20';
const PRIVATE_KEY = '0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a';

// 合约ABI - 只需要verifyAggregateSignature函数
const CONTRACT_ABI = [
  {
    "inputs": [
      {
        "components": [
          {"internalType": "uint256", "name": "X", "type": "uint256"},
          {"internalType": "uint256", "name": "Y", "type": "uint256"}
        ],
        "internalType": "struct BLSAggregateVerification.G1Point",
        "name": "_aggPk",
        "type": "tuple"
      },
      {
        "components": [
          {"internalType": "uint256[2]", "name": "X", "type": "uint256[2]"},
          {"internalType": "uint256[2]", "name": "Y", "type": "uint256[2]"}
        ],
        "internalType": "struct BLSAggregateVerification.G2Point",
        "name": "_hashedMsg",
        "type": "tuple"
      },
      {
        "components": [
          {"internalType": "uint256[2]", "name": "X", "type": "uint256[2]"},
          {"internalType": "uint256[2]", "name": "Y", "type": "uint256[2]"}
        ],
        "internalType": "struct BLSAggregateVerification.G2Point",
        "name": "_aggSig",
        "type": "tuple"
      }
    ],
    "name": "verifyAggregateSignature",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  }
];

async function testBLSIntegration() {
  console.log('开始BLS端到端集成测试...\n');

  try {
    // 1. 生成BLS聚合签名
    console.log('1. 生成BLS聚合签名...');
    
    // 生成有效的BLS私钥和消息
    // 使用SecretKey.fromKeygen生成有效的私钥
    const ikm1 = new Uint8Array(32);
    const ikm2 = new Uint8Array(32);
    // 填充一些确定性的值
    ikm1.fill(1);
    ikm2.fill(2);
    
    const sk1 = SecretKey.fromKeygen(ikm1);
    const sk2 = SecretKey.fromKeygen(ikm2);
    
    const secretKeys = [sk1.toBytes(), sk2.toBytes()];
    
    // 重要：BLS聚合签名要求所有签名者都签署相同的消息
    const commonMessage = new TextEncoder().encode('Common message for BLS aggregate signature test');
    const messages = [
      commonMessage,  // 签名者1签署相同消息
      commonMessage   // 签名者2签署相同消息
    ];
    
    console.log('生成的私钥数量:', secretKeys.length);
    console.log('消息数量:', messages.length);
    
    // 生成聚合签名
    const aggregateResult = await generateAggregateSignature(secretKeys, messages);
    console.log('✓ BLS聚合签名生成成功');
    
    // 2. 转换为Solidity格式
    console.log('\n2. 转换为Solidity格式...');
    const solidityArgs = toSolidityArguments(
      aggregateResult.aggPk,
      aggregateResult.hashedMsg,
      aggregateResult.aggSig
    );
    
    console.log('聚合公钥 X:', solidityArgs.aggPk.X.toString(16));
    console.log('聚合公钥 Y:', solidityArgs.aggPk.Y.toString(16));
    console.log('哈希消息 X:', solidityArgs.hashedMsg.X.map(x => x.toString(16)));
    console.log('哈希消息 Y:', solidityArgs.hashedMsg.Y.map(y => y.toString(16)));
    console.log('聚合签名 X:', solidityArgs.aggSig.X.map(x => x.toString(16)));
    console.log('聚合签名 Y:', solidityArgs.aggSig.Y.map(y => y.toString(16)));
    console.log('✓ Solidity格式转换完成');
    
    // 3. 连接到以太坊网络
    console.log('\n3. 连接到Sepolia测试网...');
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);
    
    console.log('部署者地址:', wallet.address);
    console.log('合约地址:', CONTRACT_ADDRESS);
    console.log('✓ 网络连接成功');
    
    // 4. 调用合约验证签名
    console.log('\n4. 调用合约验证BLS聚合签名...');
    
    const verificationResult = await contract.verifyAggregateSignature(
      solidityArgs.aggPk,
      solidityArgs.hashedMsg,
      solidityArgs.aggSig
    );
    
    console.log('合约验证结果:', verificationResult);
    
    if (verificationResult) {
      console.log('\n🎉 成功！BLS聚合签名验证通过！');
      console.log('✓ bls-node生成的签名与Solidity合约完全兼容');
    } else {
      console.log('\n❌ 验证失败：签名无效或格式不兼容');
    }
    
    return verificationResult;
    
  } catch (error) {
    console.error('\n❌ 测试过程中发生错误:', error);
    throw error;
  }
}

// 运行测试
if (require.main === module) {
  testBLSIntegration()
    .then((result) => {
      console.log('\n=== 测试完成 ===');
      console.log('验证结果:', result ? '成功' : '失败');
      process.exit(result ? 0 : 1);
    })
    .catch((error) => {
      console.error('测试失败:', error);
      process.exit(1);
    });
}

export { testBLSIntegration };