import type { NextConfig } from "next";
import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  // Only use standalone output when explicitly enabled (e.g., for Docker builds)
  // Set NEXT_BUILD_STANDALONE=true when building for Docker
  // This prevents warnings when using 'npm run start' locally
  ...(process.env.NEXT_BUILD_STANDALONE === "true" && {
    output: "standalone",
    outputFileTracingRoot: path.join(__dirname, ".."),
  }),
  // Fix for monorepo setup with Next.js 16+
  // Point to monorepo root where node_modules/next is located
  turbopack: {
    root: path.join(__dirname, ".."),
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
