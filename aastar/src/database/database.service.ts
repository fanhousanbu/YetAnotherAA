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
