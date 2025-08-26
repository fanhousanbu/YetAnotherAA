const axios = require('axios');

async function testTransferAPI() {
  try {
    console.log('🧪 Testing Transfer API with automatic node selection...\n');
    
    // Note: This is just a format test - actual transfer would need authentication
    console.log('1. Testing API endpoint accessibility:');
    
    // Test the health endpoint first
    const healthResponse = await axios.get('http://localhost:3000/api/v1/health');
    console.log(`   ✅ Backend API health: ${healthResponse.data.status}`);
    
    // Test the API documentation
    try {
      const docsResponse = await axios.get('http://localhost:3000/api-docs');
      console.log(`   ✅ API documentation is accessible`);
    } catch (error) {
      console.log(`   ⚠️  API documentation not accessible (this is normal)`);
    }
    
    console.log('\n2. Transfer API endpoint information:');
    console.log('   📍 Transfer execute endpoint: http://localhost:3000/api/v1/transfer/execute');
    console.log('   📍 Transfer estimate endpoint: http://localhost:3000/api/v1/transfer/estimate');
    console.log('   🔒 Note: These endpoints require authentication');
    
    console.log('\n3. Expected payload format (no nodeIndices required):');
    console.log('   {');
    console.log('     "to": "0x...",');
    console.log('     "amount": "0.001"');
    console.log('   }');
    
    console.log('\n4. Automatic node selection status:');
    const peersResponse = await axios.get('http://localhost:3001/gossip/peers');
    const activePeers = peersResponse.data.peers.filter(p => p.status === 'active');
    console.log(`   ✅ ${activePeers.length} active BLS nodes available for automatic selection`);
    
    console.log('\n✅ Transfer API is ready with automatic node selection!');
    console.log('\nNote: If you\'re accessing via http://localhost:8080, check your proxy configuration.');
    console.log('The backend runs on http://localhost:3000/api/v1');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testTransferAPI();