import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PersistenceAdapter } from "./persistence.interface";
import { JsonAdapter } from "./adapters/json.adapter";
import { PostgresAdapter } from "./adapters/postgres.adapter";

@Injectable()
export class DatabaseService implements OnModuleInit, PersistenceAdapter {
  private adapter: PersistenceAdapter;

  constructor(
    private configService: ConfigService,
    private jsonAdapter: JsonAdapter,
    private postgresAdapter?: PostgresAdapter
  ) {}

  async onModuleInit() {
    const dbType = this.configService.get<string>("DB_TYPE", "json");

    if (dbType === "postgres") {
      if (!this.postgresAdapter) {
        throw new Error("PostgreSQL adapter not available. Make sure DB_TYPE is set correctly.");
      }
      this.adapter = this.postgresAdapter;
      console.log("🔄 Using PostgreSQL persistence adapter");
    } else {
      this.adapter = this.jsonAdapter;
      console.log("🔄 Using JSON persistence adapter");
    }

    // Ensure adapter is initialized
    if (!this.adapter) {
      throw new Error("Failed to initialize persistence adapter");
    }

    // Migrate existing JSON data to PostgreSQL if needed
    if (dbType === "postgres" && this.configService.get<boolean>("DB_MIGRATE_FROM_JSON", false)) {
      await this.migrateFromJsonToPostgres();
    }
  }

  private async migrateFromJsonToPostgres(): Promise<void> {
    console.log("🔄 Starting migration from JSON to PostgreSQL...");

    try {
      // Migrate users
      const jsonUsers = await this.jsonAdapter.getUsers();
      for (const user of jsonUsers) {
        const existing = await this.postgresAdapter.findUserById(user.id);
        if (!existing) {
          await this.postgresAdapter.saveUser(user);
        }
      }

      // Migrate accounts (with data validation)
      const accounts = await this.jsonAdapter.getAccounts();
      const migratedUsers = await this.postgresAdapter.getUsers();
      const validUserIds = new Set(migratedUsers.map(u => u.id));

      for (const account of accounts) {
        if (!validUserIds.has(account.userId)) {
          console.warn(
            `⚠️  Skipping account ${account.address} - referenced user ${account.userId} does not exist`
          );
          continue;
        }

        const existing = await this.postgresAdapter.findAccountByUserId(account.userId);
        if (!existing) {
          await this.postgresAdapter.saveAccount(account);
        }
      }

      // Migrate transfers (with data validation)
      const transfers = await this.jsonAdapter.getTransfers();
      for (const transfer of transfers) {
        if (!validUserIds.has(transfer.userId)) {
          console.warn(
            `⚠️  Skipping transfer ${transfer.id} - referenced user ${transfer.userId} does not exist`
          );
          continue;
        }

        const existing = await this.postgresAdapter.findTransferById(transfer.id);
        if (!existing) {
          // Transform transfer data structure
          const transferData = {
            id: transfer.id,
            userId: transfer.userId,
            transferData: {
              // Store the entire transfer object except id, userId, and createdAt
              ...Object.fromEntries(
                Object.entries(transfer).filter(
                  ([key]) => !["id", "userId", "createdAt"].includes(key)
                )
              ),
            },
            createdAt: transfer.createdAt,
          };
          await this.postgresAdapter.saveTransfer(transferData);
        }
      }

      // Migrate passkeys (with data validation)
      const passkeys = await this.jsonAdapter.getPasskeys();

      for (const passkey of passkeys) {
        // Skip passkeys with missing user references
        if (!validUserIds.has(passkey.userId)) {
          console.warn(
            `⚠️  Skipping passkey ${passkey.credentialId} - referenced user ${passkey.userId} does not exist`
          );
          continue;
        }

        const existing = await this.postgresAdapter.findPasskeyByCredentialId(passkey.credentialId);
        if (!existing) {
          // Transform the passkey data structure
          const passkeyData = {
            credentialId: passkey.credentialId,
            userId: passkey.userId,
            passkeyData: {
              id: passkey.id,
              publicKey: passkey.publicKey,
              counter: passkey.counter,
              transports: passkey.transports,
              // Include any other fields from the original passkey
              ...Object.fromEntries(
                Object.entries(passkey).filter(
                  ([key]) => !["credentialId", "userId", "createdAt"].includes(key)
                )
              ),
            },
            createdAt: passkey.createdAt,
          };
          await this.postgresAdapter.savePasskey(passkeyData);
        }
      }

      // Migrate BLS config
      const blsConfig = await this.jsonAdapter.getBlsConfig();
      if (blsConfig) {
        await this.postgresAdapter.updateBlsConfig(blsConfig);
      }

      console.log("✅ Migration from JSON to PostgreSQL completed successfully");
    } catch (error) {
      console.error("❌ Migration failed:", error);
      throw error;
    }
  }

  private ensureAdapterInitialized(): void {
    if (!this.adapter) {
      throw new Error("Database adapter not initialized. Make sure onModuleInit has completed.");
    }
  }

  // Users operations
  async getUsers(): Promise<any[]> {
    this.ensureAdapterInitialized();
    return this.adapter.getUsers();
  }

  async saveUser(user: any): Promise<void> {
    return this.adapter.saveUser(user);
  }

  async updateUser(id: string, updates: any): Promise<void> {
    return this.adapter.updateUser(id, updates);
  }

  async findUserByEmail(email: string): Promise<any> {
    return this.adapter.findUserByEmail(email);
  }

  async findUserById(id: string): Promise<any> {
    return this.adapter.findUserById(id);
  }

  // Accounts operations
  async getAccounts(): Promise<any[]> {
    return this.adapter.getAccounts();
  }

  async saveAccount(account: any): Promise<void> {
    return this.adapter.saveAccount(account);
  }

  async findAccountByUserId(userId: string): Promise<any> {
    return this.adapter.findAccountByUserId(userId);
  }

  async updateAccount(userId: string, updates: any): Promise<void> {
    return this.adapter.updateAccount(userId, updates);
  }

  // Transfers operations
  async getTransfers(): Promise<any[]> {
    return this.adapter.getTransfers();
  }

  async saveTransfer(transfer: any): Promise<void> {
    return this.adapter.saveTransfer(transfer);
  }

  async findTransfersByUserId(userId: string): Promise<any[]> {
    return this.adapter.findTransfersByUserId(userId);
  }

  async findTransferById(id: string): Promise<any> {
    return this.adapter.findTransferById(id);
  }

  async updateTransfer(id: string, updates: any): Promise<void> {
    return this.adapter.updateTransfer(id, updates);
  }

  // Passkeys operations
  async getPasskeys(): Promise<any[]> {
    return this.adapter.getPasskeys();
  }

  async savePasskey(passkey: any): Promise<void> {
    return this.adapter.savePasskey(passkey);
  }

  async findPasskeysByUserId(userId: string): Promise<any[]> {
    return this.adapter.findPasskeysByUserId(userId);
  }

  async findPasskeyByCredentialId(credentialId: string): Promise<any> {
    return this.adapter.findPasskeyByCredentialId(credentialId);
  }

  async updatePasskey(credentialId: string, updates: any): Promise<void> {
    return this.adapter.updatePasskey(credentialId, updates);
  }

  // BLS Config
  async getBlsConfig(): Promise<any> {
    return this.adapter.getBlsConfig();
  }

  async updateBlsConfig(updates: any): Promise<void> {
    return this.adapter.updateBlsConfig(updates);
  }

  async updateSignerNodesCache(discoveredNodes: any[]): Promise<void> {
    return this.adapter.updateSignerNodesCache(discoveredNodes);
  }
}
