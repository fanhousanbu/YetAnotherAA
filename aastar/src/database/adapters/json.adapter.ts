import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import { PersistenceAdapter } from "../persistence.interface";

@Injectable()
export class JsonAdapter implements PersistenceAdapter {
  private readonly dataDir: string;

  constructor() {
    const possiblePaths = [
      path.join(process.cwd(), "data"),
      path.join(process.cwd(), "aastar", "data"),
      path.join(__dirname, "..", "..", "..", "data"),
      path.join(__dirname, "..", "..", "data"),
    ];

    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        this.dataDir = possiblePath;
        console.log(`📁 JSON Data directory found at: ${this.dataDir}`);
        break;
      }
    }

    if (!this.dataDir) {
      this.dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
        console.log(`📁 Created JSON data directory at: ${this.dataDir}`);
      }
    }
  }

  private async readJSON(filename: string): Promise<any[]> {
    const filePath = path.join(this.dataDir, filename);
    try {
      const data = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeJSON(filename: string, data: any[]): Promise<void> {
    const filePath = path.join(this.dataDir, filename);
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  // Users operations
  async getUsers(): Promise<any[]> {
    return this.readJSON("users.json");
  }

  async saveUser(user: any): Promise<void> {
    const users = await this.getUsers();
    users.push(user);
    await this.writeJSON("users.json", users);
  }

  async updateUser(id: string, updates: any): Promise<void> {
    const users = await this.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      await this.writeJSON("users.json", users);
    }
  }

  async findUserByEmail(email: string): Promise<any> {
    const users = await this.getUsers();
    return users.find(u => u.email === email);
  }

  async findUserById(id: string): Promise<any> {
    const users = await this.getUsers();
    return users.find(u => u.id === id);
  }

  // Accounts operations
  async getAccounts(): Promise<any[]> {
    return this.readJSON("accounts.json");
  }

  async saveAccount(account: any): Promise<void> {
    const accounts = await this.getAccounts();
    accounts.push(account);
    await this.writeJSON("accounts.json", accounts);
  }

  async findAccountByUserId(userId: string): Promise<any> {
    const accounts = await this.getAccounts();
    return accounts.find(a => a.userId === userId);
  }

  async updateAccount(userId: string, updates: any): Promise<void> {
    const accounts = await this.getAccounts();
    const index = accounts.findIndex(a => a.userId === userId);
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...updates };
      await this.writeJSON("accounts.json", accounts);
    }
  }

  // Transfers operations
  async getTransfers(): Promise<any[]> {
    return this.readJSON("transfers.json");
  }

  async saveTransfer(transfer: any): Promise<void> {
    const transfers = await this.getTransfers();
    transfers.push(transfer);
    await this.writeJSON("transfers.json", transfers);
  }

  async findTransfersByUserId(userId: string): Promise<any[]> {
    const transfers = await this.getTransfers();
    return transfers.filter(t => t.userId === userId);
  }

  async findTransferById(id: string): Promise<any> {
    const transfers = await this.getTransfers();
    return transfers.find(t => t.id === id);
  }

  async updateTransfer(id: string, updates: any): Promise<void> {
    const transfers = await this.getTransfers();
    const index = transfers.findIndex(t => t.id === id);
    if (index !== -1) {
      transfers[index] = { ...transfers[index], ...updates };
      await this.writeJSON("transfers.json", transfers);
    }
  }

  // Passkeys operations
  async getPasskeys(): Promise<any[]> {
    return this.readJSON("passkeys.json");
  }

  async savePasskey(passkey: any): Promise<void> {
    const passkeys = await this.getPasskeys();
    passkeys.push(passkey);
    await this.writeJSON("passkeys.json", passkeys);
  }

  async findPasskeysByUserId(userId: string): Promise<any[]> {
    const passkeys = await this.getPasskeys();
    return passkeys.filter(p => p.userId === userId);
  }

  async findPasskeyByCredentialId(credentialId: string): Promise<any> {
    const passkeys = await this.getPasskeys();
    return passkeys.find(p => p.credentialId === credentialId);
  }

  async updatePasskey(credentialId: string, updates: any): Promise<void> {
    const passkeys = await this.getPasskeys();
    const index = passkeys.findIndex(p => p.credentialId === credentialId);
    if (index !== -1) {
      passkeys[index] = { ...passkeys[index], ...updates };
      await this.writeJSON("passkeys.json", passkeys);
    }
  }

  // BLS Config
  async getBlsConfig(): Promise<any> {
    const filePath = path.join(this.dataDir, "bls-config.json");
    try {
      const data = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(data);
    } catch {
      console.warn(`⚠️  Could not read bls-config.json from ${filePath}, using default config`);
      const defaultConfig = {
        signerNodes: {
          nodes: [],
          totalNodes: 0,
          activeNodes: 0,
        },
        discovery: {
          seedNodes: [],
          fallbackEndpoints: [],
        },
      };

      try {
        await fs.promises.writeFile(filePath, JSON.stringify(defaultConfig, null, 2));
        console.log(`✅ Created default bls-config.json at ${filePath}`);
      } catch (writeError) {
        console.error(`❌ Could not create bls-config.json: ${writeError}`);
      }

      return defaultConfig;
    }
  }

  async updateBlsConfig(updates: any): Promise<void> {
    const filePath = path.join(this.dataDir, "bls-config.json");
    try {
      const currentConfig = (await this.getBlsConfig()) || {};
      const updatedConfig = { ...currentConfig, ...updates };
      updatedConfig.lastUpdated = new Date().toISOString();
      await fs.promises.writeFile(filePath, JSON.stringify(updatedConfig, null, 2));
    } catch (error) {
      console.error("Failed to update BLS config:", error);
      throw new Error("Failed to update BLS configuration");
    }
  }

  async updateSignerNodesCache(discoveredNodes: any[]): Promise<void> {
    const filePath = path.join(this.dataDir, "bls-config.json");
    try {
      const currentConfig = (await this.getBlsConfig()) || {};

      const updatedSignerNodes = {
        ...currentConfig.signerNodes,
        nodes: discoveredNodes.map((node, index) => ({
          nodeId: node.nodeId || node.id,
          nodeName: node.nodeName || node.name || `discovered_node_${index + 1}`,
          apiEndpoint: node.apiEndpoint || node.endpoint,
          publicKey: node.publicKey || "",
          status: "active",
          lastSeen: new Date().toISOString(),
          description: `Auto-discovered via gossip network`,
        })),
        totalNodes: discoveredNodes.length,
        activeNodes: discoveredNodes.length,
        lastUpdated: new Date().toISOString(),
      };

      const updatedConfig = {
        ...currentConfig,
        signerNodes: updatedSignerNodes,
        lastUpdated: new Date().toISOString(),
      };

      await fs.promises.writeFile(filePath, JSON.stringify(updatedConfig, null, 2));
      console.log(`📝 Updated bls-config.json with ${discoveredNodes.length} discovered nodes`);
    } catch (error) {
      console.error("Failed to update signer nodes cache:", error);
      throw new Error("Failed to update signer nodes cache");
    }
  }
}
