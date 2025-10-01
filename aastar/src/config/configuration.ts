export default () => {
  // Validate required environment variables
  const requiredVars = ["JWT_SECRET", "USER_ENCRYPTION_KEY", "ETH_RPC_URL", "BUNDLER_RPC_URL"];

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

  // Check if at least one EntryPoint version is configured
  const hasV6Config =
    process.env.ENTRY_POINT_ADDRESS &&
    process.env.AASTAR_ACCOUNT_FACTORY_ADDRESS &&
    process.env.VALIDATOR_CONTRACT_ADDRESS;

  const hasV7Config =
    process.env.ENTRY_POINT_V7_ADDRESS &&
    process.env.AASTAR_ACCOUNT_FACTORY_V7_ADDRESS &&
    process.env.VALIDATOR_CONTRACT_V7_ADDRESS;

  const hasV8Config =
    process.env.ENTRY_POINT_V8_ADDRESS &&
    process.env.AASTAR_ACCOUNT_FACTORY_V8_ADDRESS &&
    process.env.VALIDATOR_CONTRACT_V8_ADDRESS;

  if (!hasV6Config && !hasV7Config && !hasV8Config) {
    throw new Error("At least one EntryPoint version must be configured");
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
    // v0.6 configuration (backward compatibility)
    entryPointAddress: process.env.ENTRY_POINT_ADDRESS,
    aastarAccountFactoryAddress: process.env.AASTAR_ACCOUNT_FACTORY_ADDRESS,
    validatorContractAddress: process.env.VALIDATOR_CONTRACT_ADDRESS,
    // v0.7 configuration
    entryPointV7Address: process.env.ENTRY_POINT_V7_ADDRESS,
    aastarAccountFactoryV7Address: process.env.AASTAR_ACCOUNT_FACTORY_V7_ADDRESS,
    validatorContractV7Address: process.env.VALIDATOR_CONTRACT_V7_ADDRESS,
    // v0.8 configuration
    entryPointV8Address: process.env.ENTRY_POINT_V8_ADDRESS,
    aastarAccountFactoryV8Address: process.env.AASTAR_ACCOUNT_FACTORY_V8_ADDRESS,
    validatorContractV8Address: process.env.VALIDATOR_CONTRACT_V8_ADDRESS,
    // Default version (can be overridden per account)
    defaultEntryPointVersion: process.env.DEFAULT_ENTRYPOINT_VERSION || "0.6",
    blsSeedNodes: process.env.BLS_SEED_NODES,
    blsFallbackEndpoints: process.env.BLS_FALLBACK_ENDPOINTS,
  };
};
