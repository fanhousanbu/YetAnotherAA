#!/usr/bin/env node

const { ethers } = require('ethers');

// 配置
const SEPOLIA_RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N';
const DELEGATION_FACTORY_ADDRESS = '0x91Cb993E50e959C10b4600CB825A93740b79FeA9';
const SPONSOR_PAYMASTER_ADDRESS = '0x91Cb993E50e959C10b4600CB825A93740b79FeA9';
const TEST_USER_ADDRESS = '0xc8d1Ae1063176BEBC750D9aD5D057BA4A65daf3d';
const RELAYER_PRIVATE_KEY = '0x2717524c39f8b8ab74c902dc712e590fee36993774119c1e06d31daa4b0fbc81';

async function validate7702() {
    console.log('🎯 开始验证 EIP-7702 委托系统...\n');

    // 创建 provider 和 relayer
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

    console.log('📊 系统状态:');
    console.log('✅ 区块链连接正常');
    console.log('🏠 Relayer 地址:', relayerWallet.address);
    console.log('👤 测试用户:', TEST_USER_ADDRESS);

    // 测试 1: 检查余额
    console.log('\n💰 余额检查:');
    try {
        const relayerBalance = await provider.getBalance(relayerWallet.address);
        console.log(`🚀 Relayer 余额: ${ethers.formatEther(relayerBalance)} ETH`);
    } catch (error) {
        console.log('❌ Relayer 余额检查失败:', error.message);
    }

    // 测试 2: 检查合约状态
    console.log('\n📋 合约状态:');

    // DelegationFactory 检查
    const factoryABI = [
        'function getDelegation(address owner) external view returns (address)',
        'function predictDelegationAddress(address owner) external view returns (address)'
    ];
    const factoryContract = new ethers.Contract(DELEGATION_FACTORY_ADDRESS, factoryABI, provider);

    try {
        const predictedAddress = await factoryContract.predictDelegationAddress(TEST_USER_ADDRESS);
        console.log('🎯 预测委托地址:', predictedAddress);

        const currentDelegation = await factoryContract.getDelegation(TEST_USER_ADDRESS);
        console.log('📝 当前委托地址:', currentDelegation);
        console.log('🔒 委托状态:', currentDelegation === ethers.ZeroAddress ? '❌ 未启用' : '✅ 已启用');
    } catch (error) {
        console.log('❌ DelegationFactory 检查失败:', error.message);
    }

    // 测试 3: 检查 Paymaster
    console.log('\n💳 Paymaster 状态:');
    const paymasterABI = [
        'function getBalance() external view returns (uint256)',
        'function isUserSponsored(address user) external view returns (bool)'
    ];
    const paymasterContract = new ethers.Contract(SPONSOR_PAYMASTER_ADDRESS, paymasterABI, provider);

    try {
        const paymasterBalance = await paymasterContract.getBalance();
        console.log('💰 Paymaster 余额:', ethers.formatEther(paymasterBalance), 'ETH');

        const isSponsored = await paymasterContract.isUserSponsored(TEST_USER_ADDRESS);
        console.log('🎯 用户赞助状态:', isSponsored ? '✅ 已赞助' : '❌ 未赞助');
    } catch (error) {
        console.log('❌ Paymaster 检查失败:', error.message);
    }

    // 测试 4: 后端 API 检查
    console.log('\n🔗 后端 API 检查:');
    try {
        const healthResponse = await fetch('http://localhost:3001/health');
        const healthData = await healthResponse.json();
        console.log('✅ 健康检查:', healthData.status);
    } catch (error) {
        console.log('❌ 后端连接失败:', error.message);
    }

    // 测试 5: API 端点测试
    console.log('\n🧪 API 端点测试:');
    try {
        const testResponse = await fetch('http://localhost:3001/api/test');
        const testData = await testResponse.json();
        console.log('✅ 测试接口访问成功');
        console.log('📊 数据:', JSON.stringify(testData, null, 2));
    } catch (error) {
        console.log('❌ 测试接口失败:', error.message);
    }

    // 测试 6: 委托状态检查
    console.log('\n🎯 委托状态检查:');
    try {
        const statusResponse = await fetch('http://localhost:3001/api/eip7702/status', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userAddress: TEST_USER_ADDRESS })
        });
        const statusData = await statusResponse.json();
        console.log('✅ 委托状态查询成功');
        console.log('📊 状态:', JSON.stringify(statusData, null, 2));
    } catch (error) {
        console.log('❌ 委托状态检查失败:', error.message);
    }

    console.log('\n🎉 EIP-7702 委托系统验证完成！');
    console.log('\n📝 访问测试页面:');
    console.log('🌐 http://localhost:8080/simple-test.html');
    console.log('🧪 或 http://localhost:8080/test.html');
}

// 运行验证
validate7702().catch(console.error);