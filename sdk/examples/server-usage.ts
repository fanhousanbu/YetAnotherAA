/**
 * YAAA Server SDK - Usage Examples
 *
 * This example demonstrates how to integrate the YAAA Server SDK
 * into your own Node.js backend (Express, Fastify, Koa, etc.)
 * without any NestJS dependency.
 *
 * Install: npm install @yaaa/sdk
 * Import:  import { ... } from '@yaaa/sdk/server';
 */

import {
  YAAAServerClient,
  MemoryStorage,
  LocalWalletSigner,
  ConsoleLogger,
  EntryPointVersion,
} from "@yaaa/sdk/server";

import type {
  ServerConfig,
  IStorageAdapter,
  ISignerAdapter,
  AccountRecord,
  TransferRecord,
  PaymasterRecord,
  BlsConfigRecord,
  TokenInfo,
} from "@yaaa/sdk/server";

// ============================================
// 1. Basic Setup — Quick Start
// ============================================

async function quickStart() {
  // Minimum viable setup: MemoryStorage + LocalWalletSigner
  // Good for development, testing, and prototyping.
  const client = new YAAAServerClient({
    rpcUrl: "https://sepolia.infura.io/v3/YOUR_KEY",
    bundlerRpcUrl: "https://api.pimlico.io/v2/11155111/rpc?apikey=YOUR_KEY",
    chainId: 11155111,
    entryPoints: {
      v06: {
        entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        factoryAddress: "0xYOUR_FACTORY_ADDRESS",
        validatorAddress: "0xYOUR_VALIDATOR_ADDRESS",
      },
    },
    storage: new MemoryStorage(),
    signer: new LocalWalletSigner("0xYOUR_PRIVATE_KEY"),
  });

  // Create a smart account for a user
  const account = await client.accounts.createAccount("user-123");
  console.log("Smart account address:", account.address);

  // Execute a transfer
  const result = await client.transfers.executeTransfer("user-123", {
    to: "0xRecipientAddress",
    amount: "0.01",
  });
  console.log("Transfer ID:", result.transferId);
  console.log("UserOp Hash:", result.userOpHash);

  // Poll transfer status
  const status = await client.transfers.getTransferStatus("user-123", result.transferId);
  console.log("Status:", status.statusDescription);
}

// ============================================
// 2. Production Setup — Custom Adapters
// ============================================

/**
 * In production you'll want a real database and a secure key management system.
 * Implement IStorageAdapter and ISignerAdapter for your stack.
 */

// Example: PostgreSQL storage adapter (pseudo-code)
class PostgresStorage implements IStorageAdapter {
  constructor(private pool: any /* pg.Pool */) {}

  async getAccounts(): Promise<AccountRecord[]> {
    const { rows } = await this.pool.query("SELECT * FROM accounts");
    return rows;
  }

  async saveAccount(account: AccountRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO accounts (user_id, address, signer_address, salt, deployed,
       deployment_tx_hash, validator_address, entry_point_version, factory_address, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (user_id, entry_point_version) DO NOTHING`,
      [
        account.userId,
        account.address,
        account.signerAddress,
        account.salt,
        account.deployed,
        account.deploymentTxHash,
        account.validatorAddress,
        account.entryPointVersion,
        account.factoryAddress,
        account.createdAt,
      ]
    );
  }

  async findAccountByUserId(userId: string): Promise<AccountRecord | null> {
    const { rows } = await this.pool.query("SELECT * FROM accounts WHERE user_id = $1 LIMIT 1", [
      userId,
    ]);
    return rows[0] ?? null;
  }

  async updateAccount(userId: string, updates: Partial<AccountRecord>): Promise<void> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    for (const [key, value] of Object.entries(updates)) {
      setClauses.push(`${camelToSnake(key)} = $${idx++}`);
      values.push(value);
    }
    values.push(userId);
    await this.pool.query(
      `UPDATE accounts SET ${setClauses.join(", ")} WHERE user_id = $${idx}`,
      values
    );
  }

  async saveTransfer(transfer: TransferRecord): Promise<void> {
    // ... INSERT INTO transfers
    void transfer;
  }
  async findTransfersByUserId(userId: string): Promise<TransferRecord[]> {
    const { rows } = await this.pool.query("SELECT * FROM transfers WHERE user_id = $1", [userId]);
    return rows;
  }
  async findTransferById(id: string): Promise<TransferRecord | null> {
    const { rows } = await this.pool.query("SELECT * FROM transfers WHERE id = $1", [id]);
    return rows[0] ?? null;
  }
  async updateTransfer(id: string, updates: Partial<TransferRecord>): Promise<void> {
    void id;
    void updates;
  }

  async getPaymasters(userId: string): Promise<PaymasterRecord[]> {
    const { rows } = await this.pool.query("SELECT * FROM paymasters WHERE user_id = $1", [userId]);
    return rows;
  }
  async savePaymaster(userId: string, paymaster: PaymasterRecord): Promise<void> {
    void userId;
    void paymaster;
  }
  async removePaymaster(userId: string, name: string): Promise<boolean> {
    const { rowCount } = await this.pool.query(
      "DELETE FROM paymasters WHERE user_id = $1 AND name = $2",
      [userId, name]
    );
    return rowCount > 0;
  }

  async getBlsConfig(): Promise<BlsConfigRecord | null> {
    return null;
  }
  async updateSignerNodesCache(nodes: unknown[]): Promise<void> {
    void nodes;
  }
}

function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

// Example: AWS KMS signer adapter (pseudo-code)
import { ethers } from "ethers";

class AwsKmsSignerAdapter implements ISignerAdapter {
  constructor(
    private kmsKeyMapping: Map<string, string>, // userId → KMS key ID
    private rpcUrl: string
  ) {}

  async getAddress(userId: string): Promise<string> {
    // Derive address from KMS public key
    const keyId = this.kmsKeyMapping.get(userId);
    if (!keyId) throw new Error(`No KMS key for user ${userId}`);
    // ... call AWS KMS GetPublicKey, derive ETH address
    return "0x...";
  }

  async getSigner(userId: string): Promise<ethers.Signer> {
    // Return a custom AbstractSigner backed by KMS
    // You can use the built-in KmsSigner from the SDK:
    //   import { KmsSigner } from '@yaaa/sdk/server';
    void userId;
    throw new Error("Implement with KmsSigner or custom AbstractSigner");
  }

  async ensureSigner(userId: string): Promise<{ signer: ethers.Signer; address: string }> {
    const address = await this.getAddress(userId);
    const signer = await this.getSigner(userId);
    return { signer, address };
  }
}

async function productionSetup() {
  const pool = null as any; // your pg.Pool instance

  const client = new YAAAServerClient({
    rpcUrl: process.env.RPC_URL!,
    bundlerRpcUrl: process.env.BUNDLER_RPC_URL!,
    chainId: Number(process.env.CHAIN_ID),
    entryPoints: {
      v06: {
        entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        factoryAddress: process.env.FACTORY_ADDRESS!,
        validatorAddress: process.env.VALIDATOR_ADDRESS!,
      },
    },
    storage: new PostgresStorage(pool),
    signer: new AwsKmsSignerAdapter(new Map(), process.env.RPC_URL!),
    logger: new ConsoleLogger("[MyApp]"),
  });

  return client;
}

// ============================================
// 3. Account Management
// ============================================

async function accountManagement(client: YAAAServerClient) {
  // Create account (idempotent — returns existing if already created)
  const account = await client.accounts.createAccount("user-abc");
  console.log("Account:", account.address);
  console.log("Deployed:", account.deployed);
  console.log("EntryPoint version:", account.entryPointVersion);

  // Get existing account
  const existing = await client.accounts.getAccountByUserId("user-abc");
  if (existing) {
    console.log("Found existing account:", existing.address);
  }

  // Get wallet (EOA) address for a user
  const walletAddress = await client.wallets.getAddress("user-abc");
  console.log("Wallet (EOA) address:", walletAddress);
}

// ============================================
// 4. Token Operations
// ============================================

async function tokenOperations(client: YAAAServerClient) {
  const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

  // Query token info from chain
  const info: TokenInfo = await client.tokens.getTokenInfo(USDC);
  console.log(`${info.symbol} (${info.name}) — ${info.decimals} decimals`);

  // Check token balance
  const balance = await client.tokens.getTokenBalance(USDC, "0xYourSmartAccount");
  console.log("USDC balance (raw):", balance);

  // Formatted balance
  const formatted = await client.tokens.getFormattedTokenBalance(USDC, "0xYourSmartAccount");
  console.log(`Balance: ${formatted.formattedBalance} ${formatted.token.symbol}`);

  // Validate a token address
  const valid = await client.tokens.validateToken(USDC);
  console.log("Is valid ERC20:", valid);

  // Generate ERC20 transfer calldata (useful for building custom UserOps)
  const calldata = client.tokens.generateTransferCalldata(
    "0xRecipient",
    "100.5", // human-readable amount
    6 // USDC decimals
  );
  console.log("Transfer calldata:", calldata);
}

// ============================================
// 5. Transfers (ETH & ERC20)
// ============================================

async function transfers(client: YAAAServerClient) {
  const userId = "user-abc";

  // --- ETH transfer ---
  const ethTransfer = await client.transfers.executeTransfer(userId, {
    to: "0xRecipientAddress",
    amount: "0.01", // in ETH
  });
  console.log("ETH Transfer:", ethTransfer.transferId);

  // --- ERC20 token transfer ---
  const tokenTransfer = await client.transfers.executeTransfer(userId, {
    to: "0xRecipientAddress",
    amount: "50", // in token units (e.g., 50 USDC)
    tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  });
  console.log("Token Transfer:", tokenTransfer.transferId);

  // --- Gasless transfer with paymaster ---
  const gaslessTransfer = await client.transfers.executeTransfer(userId, {
    to: "0xRecipientAddress",
    amount: "0.01",
    usePaymaster: true,
    paymasterAddress: "0xYourPaymasterAddress",
  });
  console.log("Gasless Transfer:", gaslessTransfer.transferId);

  // --- Check transfer status ---
  const status = await client.transfers.getTransferStatus(userId, ethTransfer.transferId);
  console.log("Status:", status.statusDescription);
  // Possible statuses:
  //   pending   → "Preparing transaction and generating signatures"
  //   submitted → "Transaction submitted to bundler, waiting for confirmation"
  //   completed → "Transaction confirmed on chain"
  //   failed    → "Transaction failed"

  if (status.explorerUrl) {
    console.log("Explorer:", status.explorerUrl);
  }

  // --- Transfer history with pagination ---
  const history = await client.transfers.getTransferHistory(userId, 1, 10);
  console.log(`Page 1: ${history.transfers.length} of ${history.total} transfers`);
  console.log(`Total pages: ${history.totalPages}`);

  for (const tx of history.transfers) {
    console.log(`  ${tx.id}: ${tx.amount} ${tx.tokenSymbol ?? "ETH"} → ${tx.to} [${tx.status}]`);
  }

  // --- Gas estimation ---
  const gasEstimate = await client.transfers.estimateGas(userId, {
    to: "0xRecipientAddress",
    amount: "0.01",
  });
  console.log("Gas estimate:", gasEstimate);
}

// ============================================
// 6. Paymaster Management
// ============================================

async function paymasterManagement(client: YAAAServerClient) {
  const userId = "user-abc";

  // Add a custom paymaster
  await client.paymaster.addCustomPaymaster(
    userId,
    "my-paymaster",
    "0xPaymasterContractAddress",
    "custom"
  );

  // Add a Pimlico paymaster (with API key for sponsored transactions)
  await client.paymaster.addCustomPaymaster(
    userId,
    "pimlico-pm",
    "0xPimlicoPaymasterAddress",
    "pimlico",
    "pm_api_key_xxx" // apiKey
  );

  // List available paymasters
  const paymasters = await client.paymaster.getAvailablePaymasters(userId);
  for (const pm of paymasters) {
    console.log(`  ${pm.name}: ${pm.address} (configured: ${pm.configured})`);
  }

  // Remove a paymaster
  const removed = await client.paymaster.removeCustomPaymaster(userId, "my-paymaster");
  console.log("Removed:", removed);
}

// ============================================
// 7. BLS Signature Service
// ============================================

async function blsSignatures(client: YAAAServerClient) {
  // BLS signatures require seed nodes for the gossip network.
  // Configure them in the ServerConfig:
  const blsClient = new YAAAServerClient({
    rpcUrl: "https://sepolia.infura.io/v3/YOUR_KEY",
    bundlerRpcUrl: "https://api.pimlico.io/v2/11155111/rpc?apikey=YOUR_KEY",
    chainId: 11155111,
    entryPoints: {
      v06: {
        entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        factoryAddress: "0xFACTORY",
        validatorAddress: "0xVALIDATOR",
      },
    },
    blsSeedNodes: ["https://signer1.aastar.io", "https://signer2.aastar.io"],
    blsDiscoveryTimeout: 5000, // ms
    storage: new MemoryStorage(),
    signer: new LocalWalletSigner("0xPRIVATE_KEY"),
  });

  // Generate BLS signature for a UserOp hash
  // (Usually called internally by TransferManager, but available for advanced use)
  const userOpHash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
  const blsData = await blsClient.bls.generateBLSSignature("user-abc", userOpHash);
  console.log("BLS signature data:", blsData);

  // Pack signature for on-chain verification
  const packed = await blsClient.bls.packSignature(blsData);
  console.log("Packed signature:", packed);
}

// ============================================
// 8. Multi-Version EntryPoint Support
// ============================================

async function multiVersion() {
  const client = new YAAAServerClient({
    rpcUrl: "https://sepolia.infura.io/v3/YOUR_KEY",
    bundlerRpcUrl: "https://api.pimlico.io/v2/11155111/rpc?apikey=YOUR_KEY",
    chainId: 11155111,
    entryPoints: {
      v06: {
        entryPointAddress: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
        factoryAddress: "0xFACTORY_V6",
        validatorAddress: "0xVALIDATOR_V6",
      },
      v07: {
        entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
        factoryAddress: "0xFACTORY_V7",
        validatorAddress: "0xVALIDATOR_V7",
      },
    },
    defaultVersion: "0.7", // default to v0.7 when not specified
    storage: new MemoryStorage(),
    signer: new LocalWalletSigner("0xPRIVATE_KEY"),
  });

  // Create account with specific version
  const v6Account = await client.accounts.createAccount("user-1", {
    entryPointVersion: EntryPointVersion.V0_6,
  });
  console.log("v0.6 account:", v6Account.address);

  // Default version (v0.7 in this config)
  const defaultAccount = await client.accounts.createAccount("user-2");
  console.log("Default (v0.7) account:", defaultAccount.address);

  // Check configured default
  console.log("Default version:", client.ethereum.getDefaultVersion());
}

// ============================================
// 9. Express.js Integration Example
// ============================================

/*
import express from 'express';
import { YAAAServerClient, MemoryStorage, LocalWalletSigner } from '@yaaa/sdk/server';

const app = express();
app.use(express.json());

const client = new YAAAServerClient({
  rpcUrl: process.env.RPC_URL!,
  bundlerRpcUrl: process.env.BUNDLER_RPC_URL!,
  chainId: 11155111,
  entryPoints: {
    v06: {
      entryPointAddress: '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
      factoryAddress: process.env.FACTORY_ADDRESS!,
      validatorAddress: process.env.VALIDATOR_ADDRESS!,
    },
  },
  storage: new MemoryStorage(), // Replace with your DB adapter
  signer: new LocalWalletSigner(process.env.PRIVATE_KEY!),
});

// Create account
app.post('/api/accounts', async (req, res) => {
  try {
    const { userId } = req.body;
    const account = await client.accounts.createAccount(userId);
    res.json(account);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Execute transfer
app.post('/api/transfers', async (req, res) => {
  try {
    const { userId, to, amount, tokenAddress, usePaymaster, paymasterAddress } = req.body;
    const result = await client.transfers.executeTransfer(userId, {
      to,
      amount,
      tokenAddress,
      usePaymaster,
      paymasterAddress,
    });
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Get transfer status
app.get('/api/transfers/:userId/:transferId', async (req, res) => {
  try {
    const { userId, transferId } = req.params;
    const status = await client.transfers.getTransferStatus(userId, transferId);
    res.json(status);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Transfer history
app.get('/api/transfers/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const history = await client.transfers.getTransferHistory(userId, page, limit);
    res.json(history);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Token info
app.get('/api/tokens/:address', async (req, res) => {
  try {
    const info = await client.tokens.getTokenInfo(req.params.address);
    res.json(info);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Paymaster management
app.post('/api/paymasters', async (req, res) => {
  try {
    const { userId, name, address, type, apiKey } = req.body;
    await client.paymaster.addCustomPaymaster(userId, name, address, type, apiKey);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(3000, () => console.log('Server running on :3000'));
*/

// ============================================
// Export for reference
// ============================================

export {
  quickStart,
  productionSetup,
  accountManagement,
  tokenOperations,
  transfers,
  paymasterManagement,
  blsSignatures,
  multiVersion,
};
