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
  gossip: {
    bootstrapNodes: process.env.GOSSIP_BOOTSTRAP_NODES 
      ? process.env.GOSSIP_BOOTSTRAP_NODES.split(',').map(node => node.trim())
      : ['ws://localhost:8001', 'ws://localhost:8002', 'ws://localhost:8003'],
    gossipInterval: parseInt(process.env.GOSSIP_INTERVAL || '30000', 10),
    heartbeatInterval: parseInt(process.env.GOSSIP_HEARTBEAT_INTERVAL || '15000', 10),
    reconnectInterval: parseInt(process.env.GOSSIP_RECONNECT_INTERVAL || '60000', 10),
    suspicionTimeout: parseInt(process.env.GOSSIP_SUSPICION_TIMEOUT || '45000', 10),
    cleanupTimeout: parseInt(process.env.GOSSIP_CLEANUP_TIMEOUT || '120000', 10),
    maxMessageHistory: parseInt(process.env.GOSSIP_MAX_MESSAGE_HISTORY || '1000', 10),
    maxTTL: parseInt(process.env.GOSSIP_MAX_TTL || '5', 10),
  },
  // 保持向后兼容
  p2p: {
    bootstrapNodes: process.env.P2P_BOOTSTRAP_NODES 
      ? process.env.P2P_BOOTSTRAP_NODES.split(',').map(node => node.trim())
      : ['ws://localhost:8001', 'ws://localhost:8002', 'ws://localhost:8003'],
    heartbeatInterval: parseInt(process.env.P2P_HEARTBEAT_INTERVAL || '15000', 10),
    discoveryInterval: parseInt(process.env.P2P_DISCOVERY_INTERVAL || '30000', 10),
  },
});