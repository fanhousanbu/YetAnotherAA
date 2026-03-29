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
  webpack(config) {
    const sdkRoot = path.resolve(__dirname, "../../aastar-sdk/packages/airaccount");
    // Use "$" for exact match so the base alias doesn't shadow subpath imports
    config.resolve.alias["@aastar/airaccount$"] = path.join(sdkRoot, "dist/index.js");
    config.resolve.alias["@aastar/airaccount/server"] = path.join(sdkRoot, "dist/server/index.js");
    return config;
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_API_URL || "http://127.0.0.1:3000";
    const kmsUrl = process.env.KMS_PROXY_URL || "https://kms1.aastar.io";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: "/kms-api/:path*",
        destination: `${kmsUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
