import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

@Injectable()
export class DatabaseService {
  private readonly dataDir = path.join(process.cwd(), "data");

  private readJSON(filename: string): any[] {
    const filePath = path.join(this.dataDir, filename);
    try {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  private writeJSON(filename: string, data: any[]): void {
    const filePath = path.join(this.dataDir, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  // Users operations
  getUsers(): any[] {
    return this.readJSON("users.json");
  }

  saveUser(user: any): void {
    const users = this.getUsers();
    users.push(user);
    this.writeJSON("users.json", users);
  }

  updateUser(id: string, updates: any): void {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      this.writeJSON("users.json", users);
    }
  }

  findUserByEmail(email: string): any {
    const users = this.getUsers();
    return users.find(u => u.email === email);
  }

  findUserById(id: string): any {
    const users = this.getUsers();
    return users.find(u => u.id === id);
  }

  // Accounts operations
  getAccounts(): any[] {
    return this.readJSON("accounts.json");
  }

  saveAccount(account: any): void {
    const accounts = this.getAccounts();
    accounts.push(account);
    this.writeJSON("accounts.json", accounts);
  }

  findAccountByUserId(userId: string): any {
    const accounts = this.getAccounts();
    return accounts.find(a => a.userId === userId);
  }

  updateAccount(userId: string, updates: any): void {
    const accounts = this.getAccounts();
    const index = accounts.findIndex(a => a.userId === userId);
    if (index !== -1) {
      accounts[index] = { ...accounts[index], ...updates };
      this.writeJSON("accounts.json", accounts);
    }
  }

  // Transfers operations
  getTransfers(): any[] {
    return this.readJSON("transfers.json");
  }

  saveTransfer(transfer: any): void {
    const transfers = this.getTransfers();
    transfers.push(transfer);
    this.writeJSON("transfers.json", transfers);
  }

  findTransfersByUserId(userId: string): any[] {
    const transfers = this.getTransfers();
    return transfers.filter(t => t.userId === userId);
  }

  findTransferById(id: string): any {
    const transfers = this.getTransfers();
    return transfers.find(t => t.id === id);
  }

  updateTransfer(id: string, updates: any): void {
    const transfers = this.getTransfers();
    const index = transfers.findIndex(t => t.id === id);
    if (index !== -1) {
      transfers[index] = { ...transfers[index], ...updates };
      this.writeJSON("transfers.json", transfers);
    }
  }

  // Passkeys operations
  getPasskeys(): any[] {
    return this.readJSON("passkeys.json");
  }

  savePasskey(passkey: any): void {
    const passkeys = this.getPasskeys();
    passkeys.push(passkey);
    this.writeJSON("passkeys.json", passkeys);
  }

  findPasskeysByUserId(userId: string): any[] {
    const passkeys = this.getPasskeys();
    return passkeys.filter(p => p.userId === userId);
  }

  findPasskeyByCredentialId(credentialId: string): any {
    const passkeys = this.getPasskeys();
    return passkeys.find(p => p.credentialId === credentialId);
  }

  updatePasskey(credentialId: string, updates: any): void {
    const passkeys = this.getPasskeys();
    const index = passkeys.findIndex(p => p.credentialId === credentialId);
    if (index !== -1) {
      passkeys[index] = { ...passkeys[index], ...updates };
      this.writeJSON("passkeys.json", passkeys);
    }
  }

  // BLS Config
  getBlsConfig(): any {
    const filePath = path.join(this.dataDir, "bls-config.json");
    try {
      const data = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  updateBlsConfig(updates: any): void {
    const filePath = path.join(this.dataDir, "bls-config.json");
    try {
      const currentConfig = this.getBlsConfig() || {};
      const updatedConfig = { ...currentConfig, ...updates };

      // Update lastUpdated timestamp
      updatedConfig.lastUpdated = new Date().toISOString();

      fs.writeFileSync(filePath, JSON.stringify(updatedConfig, null, 2));
    } catch (error) {
      console.error("Failed to update BLS config:", error);
      throw new Error("Failed to update BLS configuration");
    }
  }

  updateSignerNodesCache(discoveredNodes: any[]): void {
    const filePath = path.join(this.dataDir, "bls-config.json");
    try {
      const currentConfig = this.getBlsConfig() || {};

      // Update signer nodes cache
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

      fs.writeFileSync(filePath, JSON.stringify(updatedConfig, null, 2));
      console.log(`📝 Updated bls-config.json with ${discoveredNodes.length} discovered nodes`);
    } catch (error) {
      console.error("Failed to update signer nodes cache:", error);
      throw new Error("Failed to update signer nodes cache");
    }
  }
}
