import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function checkContracts() {
  const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
  
  const contracts = [
    { name: 'VALIDATOR_CONTRACT', address: process.env.VALIDATOR_CONTRACT_ADDRESS },
    { name: 'ENHANCED_FACTORY', address: process.env.ENHANCED_FACTORY_ADDRESS },
    { name: 'ECDSA_VALIDATOR', address: process.env.ECDSA_VALIDATOR_ADDRESS },
    { name: 'AASTAR_ACCOUNT_FACTORY', address: process.env.AASTAR_ACCOUNT_FACTORY_ADDRESS },
    { name: 'ENTRY_POINT', address: process.env.ENTRY_POINT_ADDRESS },
  ];
  
  console.log('检查合约部署状态:\n');
  
  for (const contract of contracts) {
    const code = await provider.getCode(contract.address!);
    const isDeployed = code !== '0x';
    console.log(`${contract.name}:`);
    console.log(`  地址: ${contract.address}`);
    console.log(`  状态: ${isDeployed ? '✅ 已部署' : '❌ 未部署'}`);
    if (isDeployed) {
      console.log(`  代码大小: ${(code.length - 2) / 2} 字节`);
    }
    console.log();
  }
}

checkContracts().catch(console.error);