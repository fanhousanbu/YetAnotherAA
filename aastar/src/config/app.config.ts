export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
    from: process.env.EMAIL_FROM || 'noreply@yourapp.com',
  },
  passkey: {
    rpName: process.env.RP_NAME || 'AA Wallet',
    rpId: process.env.RP_ID || 'localhost',
    origin: process.env.ORIGIN || 'http://localhost:3000',
  },
  blockchain: {
    rpcUrl: process.env.RPC_URL || 'https://ethereum-sepolia.publicnode.com',
    bundlerUrl: process.env.BUNDLER_URL || 'http://localhost:4337',
    blsSignerUrl: process.env.BLS_SIGNER_URL || 'http://localhost:3001',
  },
  discovery: {
    signerNodes: process.env.BLS_SIGNER_NODES 
      ? process.env.BLS_SIGNER_NODES.split(',').map(node => node.trim())
      : ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'],
    discoveryInterval: parseInt(process.env.DISCOVERY_INTERVAL || '30000', 10),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '15000', 10),
    reconnectInterval: parseInt(process.env.RECONNECT_INTERVAL || '60000', 10),
    nodeTimeout: parseInt(process.env.NODE_TIMEOUT || '45000', 10),
  },
});