import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Set explicit tracing root for Render deployment
  outputFileTracingRoot: process.env.NODE_ENV === 'production' ? undefined : process.cwd(),
  outputFileTracingExcludes: {
    '*': ['**/.git/**', '**/node_modules/@swc/**'],
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:3000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
