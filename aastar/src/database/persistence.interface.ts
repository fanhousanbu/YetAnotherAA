export interface PersistenceAdapter {
  // Users
  getUsers(): Promise<any[]>;
  saveUser(user: any): Promise<void>;
  updateUser(id: string, updates: any): Promise<void>;
  findUserByEmail(email: string): Promise<any>;
  findUserById(id: string): Promise<any>;
  findUserByWalletAddress(walletAddress: string): Promise<any>;

  // Accounts
  getAccounts(): Promise<any[]>;
  saveAccount(account: any): Promise<void>;
  findAccountByUserId(userId: string): Promise<any>;
  findAccountByAddress(address: string): Promise<any>;
  updateAccount(userId: string, updates: any): Promise<void>;
  updateAccountByAddress(address: string, updates: any): Promise<void>;

  // Transfers
  getTransfers(): Promise<any[]>;
  saveTransfer(transfer: any): Promise<void>;
  findTransfersByUserId(userId: string): Promise<any[]>;
  findTransferById(id: string): Promise<any>;
  updateTransfer(id: string, updates: any): Promise<void>;

  // Passkeys
  getPasskeys(): Promise<any[]>;
  savePasskey(passkey: any): Promise<void>;
  findPasskeysByUserId(userId: string): Promise<any[]>;
  findPasskeyByCredentialId(credentialId: string): Promise<any>;
  updatePasskey(credentialId: string, updates: any): Promise<void>;

  // BLS Config
  getBlsConfig(): Promise<any>;
  updateBlsConfig(updates: any): Promise<void>;
  updateSignerNodesCache(discoveredNodes: any[]): Promise<void>;

  // Guardians
  getGuardiansByAccount(accountAddress: string): Promise<any[]>;
  saveGuardian(guardian: any): Promise<void>;
  updateGuardian(id: string, updates: any): Promise<void>;
  findGuardian(accountAddress: string, guardianAddress: string): Promise<any>;

  // Recovery Requests
  saveRecoveryRequest(request: any): Promise<void>;
  findPendingRecovery(accountAddress: string): Promise<any>;
  updateRecoveryRequest(id: string, updates: any): Promise<void>;
}
