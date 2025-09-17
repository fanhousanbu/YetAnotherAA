# Single stage build for YetAnotherAA Docker AIO
FROM node:20.19.0-alpine

WORKDIR /app

# Install pm2 and necessary tools
RUN npm install -g pm2 && apk add --no-cache git

# Copy all source code first
COPY . .

# Install dependencies and build with correct environment variables
ENV NEXT_PUBLIC_API_URL=/api/v1
ENV BACKEND_API_URL=http://localhost:3000
# Default values for development, can be overridden at runtime
ENV WEBAUTHN_ORIGIN=http://localhost
RUN npm ci --include=dev && npm run build

# Copy the node configuration file for signer (in case it wasn't copied)
COPY signer/node_dev_001.json ./signer/node_dev_001.json

# Create pm2 ecosystem file with configurable domain support
RUN echo 'module.exports = {' > ecosystem.config.js && \
    echo '  apps: [' >> ecosystem.config.js && \
    echo '    {' >> ecosystem.config.js && \
    echo '      name: "signer-node1",' >> ecosystem.config.js && \
    echo '      cwd: "./signer",' >> ecosystem.config.js && \
    echo '      script: "node",' >> ecosystem.config.js && \
    echo '      args: "dist/main.js",' >> ecosystem.config.js && \
    echo '      env: {' >> ecosystem.config.js && \
    echo '        NODE_STATE_FILE: "./node_dev_001.json",' >> ecosystem.config.js && \
    echo '        PORT: "3001",' >> ecosystem.config.js && \
    echo '        GOSSIP_PUBLIC_URL: process.env.GOSSIP_PUBLIC_URL || "ws://localhost:3001/ws",' >> ecosystem.config.js && \
    echo '        GOSSIP_BOOTSTRAP_PEERS: process.env.GOSSIP_BOOTSTRAP_PEERS || "",' >> ecosystem.config.js && \
    echo '        VALIDATOR_CONTRACT_ADDRESS: process.env.VALIDATOR_CONTRACT_ADDRESS || "0xD9756c11686B59F7DDf39E6360230316710485af",' >> ecosystem.config.js && \
    echo '        ETH_RPC_URL: process.env.ETH_RPC_URL' >> ecosystem.config.js && \
    echo '      }' >> ecosystem.config.js && \
    echo '    },' >> ecosystem.config.js && \
    echo '    {' >> ecosystem.config.js && \
    echo '      name: "aastar-backend",' >> ecosystem.config.js && \
    echo '      cwd: "./aastar",' >> ecosystem.config.js && \
    echo '      script: "node",' >> ecosystem.config.js && \
    echo '      args: "dist/main.js",' >> ecosystem.config.js && \
    echo '      env: {' >> ecosystem.config.js && \
    echo '        PORT: "3000",' >> ecosystem.config.js && \
    echo '        NODE_ENV: process.env.NODE_ENV || "development",' >> ecosystem.config.js && \
    echo '        DB_TYPE: process.env.DB_TYPE || "json",' >> ecosystem.config.js && \
    echo '        JWT_SECRET: process.env.JWT_SECRET || "your-development-jwt-secret-key",' >> ecosystem.config.js && \
    echo '        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",' >> ecosystem.config.js && \
    echo '        WEBAUTHN_ORIGIN: process.env.WEBAUTHN_ORIGIN || "http://localhost:8080",' >> ecosystem.config.js && \
    echo '        ETH_RPC_URL: process.env.ETH_RPC_URL,' >> ecosystem.config.js && \
    echo '        ETH_PRIVATE_KEY: process.env.ETH_PRIVATE_KEY,' >> ecosystem.config.js && \
    echo '        BUNDLER_RPC_URL: process.env.BUNDLER_RPC_URL,' >> ecosystem.config.js && \
    echo '        BLS_SEED_NODES: process.env.BLS_SEED_NODES || "http://localhost:3001",' >> ecosystem.config.js && \
    echo '        ENTRY_POINT_ADDRESS: process.env.ENTRY_POINT_ADDRESS || "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",' >> ecosystem.config.js && \
    echo '        AASTAR_ACCOUNT_FACTORY_ADDRESS: process.env.AASTAR_ACCOUNT_FACTORY_ADDRESS || "0xec687B9231341aAe645FE5A825C0f28323183697",' >> ecosystem.config.js && \
    echo '        VALIDATOR_CONTRACT_ADDRESS: process.env.VALIDATOR_CONTRACT_ADDRESS || "0xD9756c11686B59F7DDf39E6360230316710485af",' >> ecosystem.config.js && \
    echo '        USER_ENCRYPTION_KEY: process.env.USER_ENCRYPTION_KEY || "your-secret-encryption-key-32-chars",' >> ecosystem.config.js && \
    echo '        PIMLICO_API_KEY: process.env.PIMLICO_API_KEY,' >> ecosystem.config.js && \
    echo '        PIMLICO_SPONSORSHIP_POLICY_ID: process.env.PIMLICO_SPONSORSHIP_POLICY_ID' >> ecosystem.config.js && \
    echo '      }' >> ecosystem.config.js && \
    echo '    },' >> ecosystem.config.js && \
    echo '    {' >> ecosystem.config.js && \
    echo '      name: "aastar-frontend",' >> ecosystem.config.js && \
    echo '      cwd: "./aastar-frontend",' >> ecosystem.config.js && \
    echo '      script: "npm",' >> ecosystem.config.js && \
    echo '      args: "run start:prod",' >> ecosystem.config.js && \
    echo '      env: {' >> ecosystem.config.js && \
    echo '        NODE_ENV: process.env.NODE_ENV || "development",' >> ecosystem.config.js && \
    echo '        PORT: "80",' >> ecosystem.config.js && \
    echo '        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "/api/v1",' >> ecosystem.config.js && \
    echo '        BACKEND_API_URL: process.env.BACKEND_API_URL || "http://localhost:3000"' >> ecosystem.config.js && \
    echo '      }' >> ecosystem.config.js && \
    echo '    }' >> ecosystem.config.js && \
    echo '  ]' >> ecosystem.config.js && \
    echo '};' >> ecosystem.config.js

# Expose port 8080 for frontend (as requested)
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start all applications with pm2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
