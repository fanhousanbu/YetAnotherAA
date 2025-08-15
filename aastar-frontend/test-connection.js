// 测试前端与后端的连接
const API_BASE = 'http://localhost:3000';

async function testConnection() {
  console.log('🧪 开始测试前端与后端的连接...\n');

  // 测试 1: 检查后端服务是否运行
  console.log('1. 检查后端服务状态...');
  try {
    const response = await fetch(`${API_BASE}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      console.log('✅ 后端服务运行正常');
    } else {
      console.log('⚠️  后端服务响应异常:', response.status);
    }
  } catch (error) {
    console.log('❌ 无法连接到后端服务:', error.message);
    console.log('请确保后端服务运行在 http://localhost:3000');
    return;
  }

  // 测试 2: 测试邮箱验证码发送
  console.log('\n2. 测试邮箱验证码发送...');
  try {
    const response = await fetch(`${API_BASE}/auth/email/send-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com'
      }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ 邮箱验证码发送成功');
    } else {
      console.log('⚠️  邮箱验证码发送失败:', data.message);
    }
  } catch (error) {
    console.log('❌ 邮箱验证码发送请求失败:', error.message);
  }

  // 测试 3: 测试 Passkey 注册开始
  console.log('\n3. 测试 Passkey 注册开始...');
  try {
    const response = await fetch(`${API_BASE}/auth/passkey/register/begin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        verificationCode: '123456'
      }),
    });
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Passkey 注册开始成功');
      console.log('   返回数据包含必要的字段:', Object.keys(data));
    } else {
      console.log('⚠️  Passkey 注册开始失败:', data.message);
    }
  } catch (error) {
    console.log('❌ Passkey 注册开始请求失败:', error.message);
  }

  // 测试 4: 测试用户信息获取（需要认证）
  console.log('\n4. 测试用户信息获取（需要认证）...');
  try {
    const response = await fetch(`${API_BASE}/user/me`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token'
      },
    });
    
    if (response.status === 401) {
      console.log('✅ 认证保护正常工作（返回 401）');
    } else {
      console.log('⚠️  认证保护异常:', response.status);
    }
  } catch (error) {
    console.log('❌ 用户信息获取请求失败:', error.message);
  }

  // 测试 5: 测试钱包信息获取（需要认证）
  console.log('\n5. 测试钱包信息获取（需要认证）...');
  try {
    const response = await fetch(`${API_BASE}/wallet/info`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token'
      },
    });
    
    if (response.status === 401) {
      console.log('✅ 钱包认证保护正常工作（返回 401）');
    } else {
      console.log('⚠️  钱包认证保护异常:', response.status);
    }
  } catch (error) {
    console.log('❌ 钱包信息获取请求失败:', error.message);
  }

  console.log('\n🎉 连接测试完成！');
  console.log('\n📝 测试结果说明:');
  console.log('- ✅ 表示功能正常');
  console.log('- ⚠️  表示功能异常但可接受');
  console.log('- ❌ 表示功能失败');
  console.log('\n💡 如果看到 ❌ 错误，请检查:');
  console.log('1. 后端服务是否运行在 http://localhost:3000');
  console.log('2. 网络连接是否正常');
  console.log('3. 后端服务配置是否正确');
}

// 运行测试
testConnection().catch(console.error);
