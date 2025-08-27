const { ethers } = require('ethers');

async function checkBalance() {
  const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20');
  const accountAddress = '0x5bA2663A23b3Ed1c219C43341fC03DFf40CbF362';
  
  console.log('🔍 检查账户状态...\n');
  console.log(`账户地址: ${accountAddress}`);
  
  // 检查余额
  const balance = await provider.getBalance(accountAddress);
  console.log(`ETH余额: ${ethers.formatEther(balance)} ETH`);
  
  // 检查是否为合约账户
  const code = await provider.getCode(accountAddress);
  const isContract = code !== '0x';
  console.log(`账户类型: ${isContract ? '智能合约账户' : '未部署的账户'}`);
  
  // 估算转账需要的gas费用
  const gasPrice = await provider.getFeeData();
  console.log(`\n⛽ 当前Gas价格:`);
  console.log(`  Base Fee: ${ethers.formatUnits(gasPrice.gasPrice || 0n, 'gwei')} gwei`);
  console.log(`  Priority Fee: ${ethers.formatUnits(gasPrice.maxPriorityFeePerGas || 0n, 'gwei')} gwei`);
  
  // 计算预估费用
  const estimatedGas = 150000n; // UserOp 典型gas消耗
  const estimatedCost = estimatedGas * (gasPrice.gasPrice || 0n);
  console.log(`\n💰 预估转账费用: ${ethers.formatEther(estimatedCost)} ETH`);
  
  // 检查余额是否足够
  if (balance < estimatedCost) {
    console.log(`\n❌ 余额不足！需要充值至少 ${ethers.formatEther(estimatedCost - balance)} ETH`);
    console.log('\n建议操作:');
    console.log('1. 从其他账户转入ETH到此地址');
    console.log('2. 或者使用测试网水龙头获取测试ETH');
    console.log('3. 或者通过API调用 /api/v1/account/fund 端点进行充值');
  } else {
    console.log(`\n✅ 余额充足，可以进行转账操作`);
  }
}

checkBalance().catch(console.error);