// 分析从错误信息中提取的签名数据
const signature = "0x00000000000000000000000000000000000000000000000000000000000000036d9979585bc7a83bff3e7bb344c002ccd630f3aa351c893f0a96728d62a371b47eab846a94cff4e4bb455c3fe8d60bd2b97c6c5a462d904e1d36739375b482c58fbc957b95dff5f5cc566d4fe9e71ce3ca8d7d6b573e015f2e47849486c593d6b4c2a62dc43e18a2d8bee93e244a5b0b023d621bfa68edb2f0b095c013cd5e47952f731a524a5c8a853f78c8475bfb0e1568f1cb42161f325bcf9dbeceacf8a7822f4922906659423488200655b27628521c6f9c1520873df75e21f691a6ad9a9f59de5214163475d2a848dc828e2ce9047c72856aa4a11f92a11e315b6418ca";

console.log('🔍 分析BLS签名格式...\n');

// 解析签名结构
console.log('签名长度:', signature.length);
console.log('预期结构: nodeIdsLength + nodeIds + signature + messagePoint\n');

// 尝试解析结构
let offset = 2; // 跳过0x

// 读取nodeIds长度 (uint256 = 32字节 = 64字符)
const nodeIdsLengthHex = signature.substring(offset, offset + 64);
offset += 64;

console.log('NodeIds长度 (hex):', nodeIdsLengthHex);
const nodeIdsLength = parseInt(nodeIdsLengthHex, 16);
console.log('NodeIds长度 (decimal):', nodeIdsLength);

// 读取nodeIds (每个32字节)
console.log('\nNodeIds:');
const nodeIds = [];
for (let i = 0; i < nodeIdsLength; i++) {
  const nodeId = signature.substring(offset, offset + 64);
  nodeIds.push('0x' + nodeId);
  console.log(`  Node ${i + 1}: 0x${nodeId}`);
  offset += 64;
}

// 剩余部分是BLS签名和消息点
const remaining = signature.substring(offset);
console.log('\n剩余数据长度:', remaining.length);
console.log('剩余数据 (前100字符):', remaining.substring(0, 100) + '...');

// BLS签名通常是96字节(192字符)，G2点通常是256字节(512字符)
console.log('\n预期：');
console.log('- BLS签名: 192字符');
console.log('- G2消息点: 512字符');
console.log('- 实际剩余:', remaining.length, '字符');

if (remaining.length >= 192) {
  const blsSignature = remaining.substring(0, 192);
  console.log('\nBLS签名 (前40字符):', blsSignature.substring(0, 40) + '...');
  
  if (remaining.length >= 192 + 512) {
    const messagePoint = remaining.substring(192, 192 + 512);
    console.log('G2消息点 (前40字符):', messagePoint.substring(0, 40) + '...');
  }
}

console.log('\n💡 问题诊断：');
console.log('1. 检查签名是否包含正确数量的nodeIds');
console.log('2. 验证BLS签名长度是否正确');
console.log('3. 确认G2消息点格式是否正确');
console.log('4. 可能需要调整签名打包格式');