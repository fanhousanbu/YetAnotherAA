const axios = require('axios');

async function testCompleteFlow() {
  try {
    console.log('🔍 Testing complete transfer flow to identify the exact error...\n');
    
    // Step 1: Test BLS signer nodes directly
    console.log('1. Testing BLS signer nodes:');
    try {
      const response = await axios.post('http://localhost:3001/signature/sign', {
        message: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
      });
      console.log('   ✅ BLS node 1 signature format:', response.data.signature.substring(0, 20) + '...');
    } catch (error) {
      console.log('   ❌ BLS node 1 error:', error.message);
    }
    
    // Step 2: Test gossip network
    console.log('\n2. Testing gossip network:');
    try {
      const response = await axios.get('http://localhost:3001/gossip/peers');
      const activePeers = response.data.peers.filter(p => p.status === 'active');
      console.log('   ✅ Active peers:', activePeers.length);
    } catch (error) {
      console.log('   ❌ Gossip network error:', error.message);
    }
    
    // Step 3: Test backend API endpoints
    console.log('\n3. Testing backend API health:');
    try {
      const response = await axios.get('http://localhost:3000/api/v1/health');
      console.log('   ✅ Backend health:', response.data.status);
    } catch (error) {
      console.log('   ❌ Backend health error:', error.message);
    }
    
    // Step 4: Monitor backend logs for any recent errors
    console.log('\n4. Checking for recent backend errors:');
    console.log('   📝 Please check the backend terminal for any stderr output');
    console.log('   🔍 Look for lines containing: Error, Exception, Failed, invalid, TypeError');
    
    // Step 5: Test frontend proxy
    console.log('\n5. Testing frontend proxy:');
    try {
      const response = await axios.get('http://localhost:8080/api/v1/health');
      console.log('   ✅ Frontend proxy working:', response.data.status);
    } catch (error) {
      console.log('   ❌ Frontend proxy error:', error.message);
    }
    
    console.log('\n💡 Next steps:');
    console.log('   1. Check the browser developer console for client-side errors');
    console.log('   2. Look at the Network tab to see the exact HTTP response');
    console.log('   3. Check if there are any CORS or authentication issues');
    console.log('   4. The backend logs should show the error after "Got signatures from 3 nodes"');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCompleteFlow();