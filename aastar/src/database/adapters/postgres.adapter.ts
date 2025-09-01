import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { PersistenceAdapter } from "../persistence.interface";
import { User, Account, Transfer, Passkey, BlsConfig } from "../../entities";

@Injectable()
export class PostgresAdapter implements PersistenceAdapter {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Account)
    private accountRepository: Repository<Account>,
    @InjectRepository(Transfer)
    private transferRepository: Repository<Transfer>,
    @InjectRepository(Passkey)
    private passkeyRepository: Repository<Passkey>,
    @InjectRepository(BlsConfig)
    private blsConfigRepository: Repository<BlsConfig>
  ) {
    console.log("🐘 PostgreSQL adapter initialized");
  }

  // Users operations
  async getUsers(): Promise<any[]> {
    return this.userRepository.find();
  }

  async saveUser(user: any): Promise<void> {
    await this.userRepository.save(user);
  }

  async updateUser(id: string, updates: any): Promise<void> {
    await this.userRepository.update(id, updates);
  }

  async findUserByEmail(email: string): Promise<any> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findUserById(id: string): Promise<any> {
    return this.userRepository.findOne({ where: { id } });
  }

  // Accounts operations
  async getAccounts(): Promise<any[]> {
    return this.accountRepository.find();
  }

  async saveAccount(account: any): Promise<void> {
    await this.accountRepository.save(account);
  }

  async findAccountByUserId(userId: string): Promise<any> {
    return this.accountRepository.findOne({ where: { userId } });
  }

  async updateAccount(userId: string, updates: any): Promise<void> {
    await this.accountRepository.update({ userId }, updates);
  }

  // Transfers operations
  async getTransfers(): Promise<any[]> {
    const transfers = await this.transferRepository.find();
    // Flatten the transferData into the main object
    return transfers.map(t => ({
      id: t.id,
      userId: t.userId,
      createdAt: t.createdAt,
      ...t.transferData,
    }));
  }

  async saveTransfer(transfer: any): Promise<void> {
    // Ensure the data structure is correct
    const transferEntity = {
      id: transfer.id,
      userId: transfer.userId,
      createdAt: transfer.createdAt,
      transferData: {
        // Put all other fields into transferData
        ...Object.fromEntries(
          Object.entries(transfer).filter(
            ([key]) => !["id", "userId", "createdAt", "transferData"].includes(key)
          )
        ),
        // If transfer already has transferData, merge it
        ...(transfer.transferData || {}),
      },
    };
    await this.transferRepository.save(transferEntity);
  }

  async findTransfersByUserId(userId: string): Promise<any[]> {
    const transfers = await this.transferRepository.find({ where: { userId } });
    // Flatten the transferData into the main object
    return transfers.map(t => ({
      id: t.id,
      userId: t.userId,
      createdAt: t.createdAt,
      ...t.transferData,
    }));
  }

  async findTransferById(id: string): Promise<any> {
    const transfer = await this.transferRepository.findOne({ where: { id } });
    if (!transfer) return null;
    // Flatten the transferData into the main object
    return {
      id: transfer.id,
      userId: transfer.userId,
      createdAt: transfer.createdAt,
      ...transfer.transferData,
    };
  }

  async updateTransfer(id: string, updates: any): Promise<void> {
    // Get the existing transfer
    const transfer = await this.transferRepository.findOne({ where: { id } });
    if (!transfer) {
      throw new Error(`Transfer ${id} not found`);
    }

    // Merge updates into transferData
    const updatedTransferData = {
      ...transfer.transferData,
      ...updates,
    };

    // Update only the transferData field
    await this.transferRepository.update(id, { transferData: updatedTransferData });
  }

  // Passkeys operations
  async getPasskeys(): Promise<any[]> {
    return this.passkeyRepository.find();
  }

  async savePasskey(passkey: any): Promise<void> {
    await this.passkeyRepository.save(passkey);
  }

  async findPasskeysByUserId(userId: string): Promise<any[]> {
    return this.passkeyRepository.find({ where: { userId } });
  }

  async findPasskeyByCredentialId(credentialId: string): Promise<any> {
    return this.passkeyRepository.findOne({ where: { credentialId } });
  }

  async updatePasskey(credentialId: string, updates: any): Promise<void> {
    await this.passkeyRepository.update({ credentialId }, updates);
  }

  // BLS Config
  async getBlsConfig(): Promise<any> {
    let config = await this.blsConfigRepository.findOne({ where: { id: 1 } });

    if (!config) {
      // Create default config if not exists
      const defaultConfig = {
        id: 1,
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

      config = await this.blsConfigRepository.save(defaultConfig);
      console.log("✅ Created default BLS config in PostgreSQL");
    }

    return config;
  }

  async updateBlsConfig(updates: any): Promise<void> {
    const currentConfig = await this.getBlsConfig();
    const updatedConfig = { ...currentConfig, ...updates };
    await this.blsConfigRepository.save({ id: 1, ...updatedConfig });
  }

  async updateSignerNodesCache(discoveredNodes: any[]): Promise<void> {
    const currentConfig = await this.getBlsConfig();

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

    await this.blsConfigRepository.save({
      id: 1,
      ...currentConfig,
      signerNodes: updatedSignerNodes,
    });

    console.log(`📝 Updated PostgreSQL bls-config with ${discoveredNodes.length} discovered nodes`);
  }
}
