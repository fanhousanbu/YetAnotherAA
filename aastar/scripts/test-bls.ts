import axios from 'axios';

async function testBLS() {
  try {
    console.log('1. 测试单个节点签名...');
    
    // 先获取单个节点的签名
    const sign1 = await axios.post('http://localhost:3001/signature/sign', {
      message: 'TestMessage123'
    });
    
    console.log('节点1签名成功:');
    console.log('  NodeId:', sign1.data.nodeId);
    console.log('  Signature:', sign1.data.signature.substring(0, 40) + '...');
    
    const sign2 = await axios.post('http://localhost:3002/signature/sign', {
      message: 'TestMessage123'
    });
    
    console.log('节点2签名成功:');
    console.log('  NodeId:', sign2.data.nodeId);
    console.log('  Signature:', sign2.data.signature.substring(0, 40) + '...');
    
    console.log('\n2. 测试签名聚合...');
    
    // 尝试聚合签名 - 需要正确的格式
    const aggregateResponse = await axios.post('http://localhost:3001/signature/aggregate', {
      signatures: [sign1.data.signature, sign2.data.signature]
    });
    
    console.log('聚合成功:');
    console.log('  响应:', JSON.stringify(aggregateResponse.data, null, 2));
    
  } catch (error: any) {
    console.error('测试失败:', error.response?.data || error.message);
  }
}

testBLS();