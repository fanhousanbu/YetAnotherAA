module.exports = {
  apps: [
    {
      name: "validator-node1",
      cwd: "./validator",
      script: "node",
      args: "dist/main.js",
      env: {
        NODE_STATE_FILE: "./node_dev_001.json",
        PORT: "3001",
        GOSSIP_PUBLIC_URL: process.env.GOSSIP_PUBLIC_URL || "ws://localhost:3001/ws",
        GOSSIP_BOOTSTRAP_PEERS: process.env.GOSSIP_BOOTSTRAP_PEERS || "",
        VALIDATOR_CONTRACT_ADDRESS:
          process.env.VALIDATOR_CONTRACT_ADDRESS || "0xD9756c11686B59F7DDf39E6360230316710485af",
        ETH_RPC_URL: process.env.ETH_RPC_URL,
      },
    },
    {
      name: "aastar-backend",
      cwd: "./aastar",
      script: "node",
      args: "dist/main.js",
      env: {
        PORT: "3000",
        NODE_ENV: process.env.NODE_ENV || "development",
        DB_TYPE: process.env.DB_TYPE || "json",
        JWT_SECRET: process.env.JWT_SECRET || "your-jwt-secret-key-change-in-production",
        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
        WEBAUTHN_ORIGIN: process.env.WEBAUTHN_ORIGIN || "http://localhost",
        ETH_RPC_URL: process.env.ETH_RPC_URL,
        ETH_PRIVATE_KEY: process.env.ETH_PRIVATE_KEY,
        BUNDLER_RPC_URL: process.env.BUNDLER_RPC_URL,
        BLS_SEED_NODES: process.env.BLS_SEED_NODES || "http://localhost:3001",
        ENTRY_POINT_ADDRESS:
          process.env.ENTRY_POINT_ADDRESS || "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        AASTAR_ACCOUNT_FACTORY_ADDRESS:
          process.env.AASTAR_ACCOUNT_FACTORY_ADDRESS ||
          "0xab18406D34B918A0431116755C45AC7af99DcDa6",
        VALIDATOR_CONTRACT_ADDRESS:
          process.env.VALIDATOR_CONTRACT_ADDRESS || "0xD9756c11686B59F7DDf39E6360230316710485af",
        ENTRY_POINT_V7_ADDRESS:
          process.env.ENTRY_POINT_V7_ADDRESS || "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
        AASTAR_ACCOUNT_FACTORY_V7_ADDRESS:
          process.env.AASTAR_ACCOUNT_FACTORY_V7_ADDRESS ||
          "0xAae813Ae38418f38701142cEab08D4F52383bF34",
        VALIDATOR_CONTRACT_V7_ADDRESS:
          process.env.VALIDATOR_CONTRACT_V7_ADDRESS || "0xD9756c11686B59F7DDf39E6360230316710485af",
        ENTRY_POINT_V8_ADDRESS:
          process.env.ENTRY_POINT_V8_ADDRESS || "0x0576a174D229E3cFA37253523E645A78A0C91B57",
        AASTAR_ACCOUNT_FACTORY_V8_ADDRESS:
          process.env.AASTAR_ACCOUNT_FACTORY_V8_ADDRESS ||
          "0x5675f3e1C97bE92F22315a5af58c9A8f1007F242",
        VALIDATOR_CONTRACT_V8_ADDRESS:
          process.env.VALIDATOR_CONTRACT_V8_ADDRESS || "0xD9756c11686B59F7DDf39E6360230316710485af",
        DEFAULT_ENTRYPOINT_VERSION: process.env.DEFAULT_ENTRYPOINT_VERSION || "0.7",
        USER_ENCRYPTION_KEY:
          process.env.USER_ENCRYPTION_KEY || "your-secret-encryption-key-32-chars",
        PIMLICO_API_KEY: process.env.PIMLICO_API_KEY,
        KMS_ENABLED: "true",
        KMS_ENDPOINT: "https://kms.aastar.io",
      },
    },
    {
      name: "aastar-frontend",
      cwd: "./aastar-frontend",
      script: "npm",
      args: "run start:prod",
      env: {
        NODE_ENV: process.env.NODE_ENV || "production",
        PORT: "80",
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "/api/v1",
        BACKEND_API_URL: process.env.BACKEND_API_URL || "http://localhost:3000",
      },
    },
  ],
};
