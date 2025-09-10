export default () => {
  // Validate required environment variables
  const requiredVars = [
    "JWT_SECRET",
    "USER_ENCRYPTION_KEY",
    "ETH_RPC_URL",
    "BUNDLER_RPC_URL",
    "ENTRY_POINT_ADDRESS",
    "AASTAR_ACCOUNT_FACTORY_ADDRESS",
    "VALIDATOR_CONTRACT_ADDRESS",
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Environment configuration validation failed:\n${missingVars.map(v => `  - ${v} is required`).join("\n")}`
    );
  }

  // Validate database configuration
  if (process.env.DB_TYPE === "postgres" && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when DB_TYPE is "postgres"');
  }

  console.log("✅ Environment configuration validated successfully");

  return {
    port: parseInt(process.env.PORT, 10) || 3000,
    nodeEnv: process.env.NODE_ENV || "development",
    apiPrefix: process.env.API_PREFIX || "api/v1",
    dbType: process.env.DB_TYPE || "json",
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
    userEncryptionKey: process.env.USER_ENCRYPTION_KEY,
    webauthnRpName: process.env.WEBAUTHN_RP_NAME || "AAstar",
    webauthnRpId: process.env.WEBAUTHN_RP_ID || "localhost",
    webauthnOrigin: process.env.WEBAUTHN_ORIGIN || "http://localhost:8080",
    ethRpcUrl: process.env.ETH_RPC_URL,
    bundlerRpcUrl: process.env.BUNDLER_RPC_URL,
    ethPrivateKey: process.env.ETH_PRIVATE_KEY,
    entryPointAddress: process.env.ENTRY_POINT_ADDRESS,
    aastarAccountFactoryAddress: process.env.AASTAR_ACCOUNT_FACTORY_ADDRESS,
    validatorContractAddress: process.env.VALIDATOR_CONTRACT_ADDRESS,
    blsSeedNodes: process.env.BLS_SEED_NODES,
    blsFallbackEndpoints: process.env.BLS_FALLBACK_ENDPOINTS,
  };
};
