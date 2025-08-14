import { Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly dataPath = join(process.cwd(), 'data');

  async ensureDataDirectory(): Promise<void> {
    try {
      await fs.access(this.dataPath);
    } catch {
      await fs.mkdir(this.dataPath, { recursive: true });
      await fs.mkdir(join(this.dataPath, 'users'), { recursive: true });
      await fs.mkdir(join(this.dataPath, 'wallets'), { recursive: true });
      await fs.mkdir(join(this.dataPath, 'sessions'), { recursive: true });
      await fs.mkdir(join(this.dataPath, 'challenges'), { recursive: true });
      await fs.mkdir(join(this.dataPath, 'verifications'), { recursive: true });
    }
  }

  async saveUser(data: any): Promise<string> {
    await this.ensureDataDirectory();
    const userId = uuidv4();
    const userWithId = { ...data, id: userId, createdAt: new Date(), updatedAt: new Date() };
    
    const filePath = join(this.dataPath, 'users', `${userId}.json`);
    await fs.writeFile(filePath, JSON.stringify(userWithId, null, 2));
    
    // Update email index
    await this.updateEmailIndex(data.email, userId);
    
    return userId;
  }

  async getUserById(userId: string): Promise<any | null> {
    try {
      const filePath = join(this.dataPath, 'users', `${userId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async getUserByEmail(email: string): Promise<any | null> {
    const userId = await this.getUserIdByEmail(email);
    if (!userId) return null;
    return this.getUserById(userId);
  }

  async updateUser(userId: string, data: any): Promise<void> {
    const existing = await this.getUserById(userId);
    if (!existing) throw new Error('User not found');
    
    const updated = { ...existing, ...data, updatedAt: new Date() };
    const filePath = join(this.dataPath, 'users', `${userId}.json`);
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2));
  }

  async saveWallet(data: any): Promise<void> {
    await this.ensureDataDirectory();
    const filePath = join(this.dataPath, 'wallets', `${data.userId}.json`);
    const walletData = { ...data, createdAt: new Date(), updatedAt: new Date() };
    await fs.writeFile(filePath, JSON.stringify(walletData, null, 2));
    
    // Update address index
    await this.updateAddressIndex(data.address, data.userId);
  }

  async getWalletByUserId(userId: string): Promise<any | null> {
    try {
      const filePath = join(this.dataPath, 'wallets', `${userId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveSession(sessionId: string, data: any): Promise<void> {
    await this.ensureDataDirectory();
    const filePath = join(this.dataPath, 'sessions', `${sessionId}.json`);
    const sessionData = { ...data, id: sessionId, createdAt: new Date() };
    await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2));
  }

  async getSession(sessionId: string): Promise<any | null> {
    try {
      const filePath = join(this.dataPath, 'sessions', `${sessionId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const filePath = join(this.dataPath, 'sessions', `${sessionId}.json`);
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async saveChallenge(challengeId: string, data: any): Promise<void> {
    await this.ensureDataDirectory();
    const filePath = join(this.dataPath, 'challenges', `${challengeId}.json`);
    const challengeData = { ...data, id: challengeId, createdAt: new Date() };
    await fs.writeFile(filePath, JSON.stringify(challengeData, null, 2));
  }

  async getChallenge(challengeId: string): Promise<any | null> {
    try {
      const filePath = join(this.dataPath, 'challenges', `${challengeId}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async deleteChallenge(challengeId: string): Promise<void> {
    try {
      const filePath = join(this.dataPath, 'challenges', `${challengeId}.json`);
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async saveEmailVerification(email: string, data: any): Promise<void> {
    await this.ensureDataDirectory();
    const filePath = join(this.dataPath, 'verifications', `${email.replace('@', '_at_')}.json`);
    const verificationData = { ...data, email, createdAt: new Date() };
    await fs.writeFile(filePath, JSON.stringify(verificationData, null, 2));
  }

  async getEmailVerification(email: string): Promise<any | null> {
    try {
      const filePath = join(this.dataPath, 'verifications', `${email.replace('@', '_at_')}.json`);
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async deleteEmailVerification(email: string): Promise<void> {
    try {
      const filePath = join(this.dataPath, 'verifications', `${email.replace('@', '_at_')}.json`);
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  private async getUserIdByEmail(email: string): Promise<string | null> {
    try {
      const indexPath = join(this.dataPath, 'users', 'email-index.json');
      const data = await fs.readFile(indexPath, 'utf-8');
      const index = JSON.parse(data);
      return index[email] || null;
    } catch {
      return null;
    }
  }

  private async updateEmailIndex(email: string, userId: string): Promise<void> {
    const indexPath = join(this.dataPath, 'users', 'email-index.json');
    let index = {};
    
    try {
      const data = await fs.readFile(indexPath, 'utf-8');
      index = JSON.parse(data);
    } catch {
      // Create new index if doesn't exist
    }
    
    index[email] = userId;
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
  }

  private async updateAddressIndex(address: string, userId: string): Promise<void> {
    const indexPath = join(this.dataPath, 'wallets', 'address-index.json');
    let index = {};
    
    try {
      const data = await fs.readFile(indexPath, 'utf-8');
      index = JSON.parse(data);
    } catch {
      // Create new index if doesn't exist
    }
    
    index[address] = userId;
    await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
  }
}