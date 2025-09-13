# Multi-stage build for YetAnotherAA Docker AIO
FROM node:20.19.0-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./
COPY aastar/package*.json ./aastar/
COPY aastar-frontend/package*.json ./aastar-frontend/
COPY signer/package*.json ./signer/

# Install dependencies
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build all projects
RUN npm run build

# Production stage
FROM node:20.19.0-alpine AS production

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY aastar/package*.json ./aastar/
COPY aastar-frontend/package*.json ./aastar-frontend/
COPY signer/package*.json ./signer/

# Install production dependencies
RUN npm ci --only=production --ignore-scripts

# Copy built applications and necessary files
COPY --from=base /app/aastar/dist ./aastar/dist
COPY --from=base /app/aastar-frontend/.next ./aastar-frontend/.next
COPY --from=base /app/aastar-frontend/public ./aastar-frontend/public
COPY --from=base /app/aastar-frontend/next.config.* ./aastar-frontend/
COPY --from=base /app/signer/dist ./signer/dist

# Copy the node configuration file for signer
COPY signer/node_dev_001.json ./signer/node_dev_001.json

# Copy any additional required files
COPY --from=base /app/aastar/src ./aastar/src
COPY --from=base /app/signer/src ./signer/src
COPY --from=base /app/aastar-frontend/src ./aastar-frontend/src

# Install pm2 for process management
RUN npm install -g pm2

# Create pm2 ecosystem file with exact launch.json Minimal:JSON configuration
RUN cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'signer-node1',
      cwd: './signer',
      script: 'node',
      args: 'dist/main.js',
      env: {
        NODE_STATE_FILE: './node_dev_001.json',
        PORT: '3001',
        GOSSIP_PUBLIC_URL: 'ws://localhost:3001/ws',
        GOSSIP_BOOTSTRAP_PEERS: '',
        VALIDATOR_CONTRACT_ADDRESS: '0xD9756c11686B59F7DDf39E6360230316710485af',
        ETH_RPC_URL: 'https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20'
      }
    },
    {
      name: 'aastar-backend',
      cwd: './aastar',
      script: 'node',
      args: 'dist/main.js',
      env: {
        PORT: '3000',
        NODE_ENV: 'development',
        DB_TYPE: 'json',
        JWT_SECRET: 'your-development-jwt-secret-key',
        JWT_EXPIRES_IN: '7d',
        ETH_RPC_URL: 'https://sepolia.infura.io/v3/7051eb377c77490881070faaf93aef20',
        ETH_PRIVATE_KEY: '0x72966a3f12beed253d475a19f4c8c73e5f7c14f2280bcda4499f72602b4d6c1a',
        BUNDLER_RPC_URL: 'https://api.pimlico.io/v2/11155111/rpc?apikey=pim_gcVkLnianG5Fj4AvFYhAEh',
        BLS_SEED_NODES: 'http://localhost:3001',
        ENTRY_POINT_ADDRESS: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
        AASTAR_ACCOUNT_FACTORY_ADDRESS: '0xec687B9231341aAe645FE5A825C0f28323183697',
        VALIDATOR_CONTRACT_ADDRESS: '0xD9756c11686B59F7DDf39E6360230316710485af',
        USER_ENCRYPTION_KEY: 'your-secret-encryption-key-32-chars',
        PAYMASTER_ADDRESS: '0x0000000000325602a77416A16136FDafd04b299f',
        PIMLICO_API_KEY: 'pim_gcVkLnianG5Fj4AvFYhAEh',
        PIMLICO_SPONSORSHIP_POLICY_ID: 'sp_lying_ironclad'
      }
    },
    {
      name: 'aastar-frontend',
      cwd: './aastar-frontend',
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'development',
        PORT: '8080'
      }
    }
  ]
};
EOF

# Expose port 8080 for frontend (as requested)
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start all applications with pm2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]