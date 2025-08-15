/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 设置开发服务器端口为 8080
  async rewrites() {
    return [
      // 代理所有 API 请求到后端
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
      // 代理认证相关请求
      {
        source: '/auth/:path*',
        destination: 'http://localhost:3000/auth/:path*',
      },
      // 代理用户相关请求
      {
        source: '/user/:path*',
        destination: 'http://localhost:3000/user/:path*',
      },
      // 代理钱包相关请求
      {
        source: '/wallet/:path*',
        destination: 'http://localhost:3000/wallet/:path*',
      },
      // 代理转账相关请求
      {
        source: '/transfer/:path*',
        destination: 'http://localhost:3000/transfer/:path*',
      },
      // 代理区块链相关请求
      {
        source: '/blockchain/:path*',
        destination: 'http://localhost:3000/blockchain/:path*',
      },
      // 代理存储相关请求
      {
        source: '/storage/:path*',
        destination: 'http://localhost:3000/storage/:path*',
      },
    ];
  }
};

module.exports = nextConfig; 