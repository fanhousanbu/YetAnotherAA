const axios = require('axios');

async function debugTransfer() {
  try {
    console.log('🔍 Debugging transfer API call...\n');
    
    // Test the transfer endpoint (this will fail with auth, but we can see the format error)
    console.log('1. Testing transfer API endpoint format:');
    
    const transferData = {
      to: '0x742d35Cc7861D14DA8F0f8E5FfF1ab34e6c7f4E0',
      amount: '0.001'
    };
    
    console.log('   📤 Sending request to: http://localhost:3000/api/v1/transfer/execute');
    console.log('   📄 Payload:', JSON.stringify(transferData, null, 2));
    
    try {
      const response = await axios.post('http://localhost:3000/api/v1/transfer/execute', transferData);
      console.log('   ✅ Success:', response.data);
    } catch (error) {
      console.log('   ❌ Expected error (authentication):');
      if (error.response) {
        console.log('   📊 Status:', error.response.status);
        console.log('   📄 Response:', error.response.data);
      } else {
        console.log('   🔗 Network error:', error.message);
      }
    }
    
    // Also test via frontend proxy
    console.log('\n2. Testing via frontend proxy:');
    console.log('   📤 Sending request to: http://localhost:8080/api/v1/transfer/execute');
    
    try {
      const response = await axios.post('http://localhost:8080/api/v1/transfer/execute', transferData);
      console.log('   ✅ Success:', response.data);
    } catch (error) {
      console.log('   ❌ Error via proxy:');
      if (error.response) {
        console.log('   📊 Status:', error.response.status);
        console.log('   📄 Response:', error.response.data);
      } else {
        console.log('   🔗 Network error:', error.message);
      }
    }
    
    console.log('\n💡 Now please try the transfer from the frontend UI.');
    console.log('   I\'ll monitor the backend logs for any 500 errors.');
    
  } catch (error) {
    console.error('❌ Debug script failed:', error.message);
  }
}

debugTransfer();