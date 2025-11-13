const { ethers } = require('ethers');

// 配置
const SEPOLIA_RPC_URL = 'https://eth-sepolia.g.alchemy.com/v2/Bx4QRW1-vnwJUePSAAD7N';
const DELEGATION_FACTORY_ADDRESS = '0x91Cb993E50e959C10b4600CB825A93740b79FeA9';
const SPONSOR_PAYMASTER_ADDRESS = '0x91Cb993E50e959C10b4600CB825A93740b79FeA9';
const TEST_USER_ADDRESS = '0xc8d1Ae1063176BEBC750D9aD5D057BA4A65daf3d';

async function testBackend() {
    console.log('🧪 开始测试后端服务...\n');

    // 创建 provider
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);

    try {
        // 1. 测试基本连接
        console.log('1. 测试区块链连接...');
        const network = await provider.getNetwork();
        console.log('✅ 网络:', network.name, '(Chain ID:', network.chainId, ')');

        // 2. 测试 DelegationFactory
        console.log('\n2. 测试 DelegationFactory...');

        // 简化版 ABI
        const factoryABI = [
            'function getDelegation(address owner) external view returns (address)',
            'function predictDelegationAddress(address owner) external view returns (address)'
        ];

        const factoryContract = new ethers.Contract(DELEGATION_FACTORY_ADDRESS, factoryABI, provider);

        // 测试预测地址
        const predictedAddress = await factoryContract.predictDelegationAddress(TEST_USER_ADDRESS);
        console.log('📋 预测的委托地址:', predictedAddress);

        // 测试获取委托 (可能返回零地址)
        try {
            const delegationAddress = await factoryContract.getDelegation(TEST_USER_ADDRESS);
            console.log('🔍 当前委托地址:', delegationAddress);
            console.log('📝 委托状态:', delegationAddress === ethers.ZeroAddress ? '❌ 未启用' : '✅ 已启用');
        } catch (error) {
            console.log('❌ 获取委托失败:', error.message);
        }

        // 3. 测试 SponsorPaymaster
        console.log('\n3. 测试 SponsorPaymaster...');

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

        // 4. 测试余额检查
        console.log('\n4. 测试余额检查...');

        try {
            const balance = await provider.getBalance(TEST_USER_ADDRESS);
            console.log('👤 用户余额:', ethers.formatEther(balance), 'ETH');
        } catch (error) {
            console.log('❌ 用户余额检查失败:', error.message);
        }

        // 5. 测试 relayer 余额
        const RELAYER_PRIVATE_KEY = '0x2717524c39f8b8ab74c902dc712e590fee36993774119c1e06d31daa4b0fbc81';
        const relayerWallet = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);

        try {
            const relayerBalance = await provider.getBalance(relayerWallet.address);
            console.log('🚀 Relayer 余额:', ethers.formatEther(relayerBalance), 'ETH');
            console.log('🏠 Relayer 地址:', relayerWallet.address);
        } catch (error) {
            console.log('❌ Relayer 余额检查失败:', error.message);
        }

        console.log('\n✅ 后端测试完成！');

    } catch (error) {
        console.error('❌ 测试失败:', error);
        process.exit(1);
    }
}

testBackend();