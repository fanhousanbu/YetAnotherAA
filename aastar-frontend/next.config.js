/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 设置开发服务器端口为 8080
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/:path*',
      },
    ];
  }
};

module.exports = nextConfig; 