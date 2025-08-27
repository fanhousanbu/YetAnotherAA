import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DatabaseService {
  private readonly dataDir = path.join(process.cwd(), 'data');

  private readJSON(filename: string): any[] {
    const filePath = path.join(this.dataDir, filename);
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
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
    return this.readJSON('users.json');
  }

  saveUser(user: any): void {
    const users = this.getUsers();
    users.push(user);
    this.writeJSON('users.json', users);
  }

  updateUser(id: string, updates: any): void {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index !== -1) {
      users[index] = { ...users[index], ...updates };
      this.writeJSON('users.json', users);
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
    return this.readJSON('accounts.json');
  }

  saveAccount(account: any): void {
    const accounts = this.getAccounts();
    accounts.push(account);
    this.writeJSON('accounts.json', accounts);
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
      this.writeJSON('accounts.json', accounts);
    }
  }

  // Transfers operations
  getTransfers(): any[] {
    return this.readJSON('transfers.json');
  }

  saveTransfer(transfer: any): void {
    const transfers = this.getTransfers();
    transfers.push(transfer);
    this.writeJSON('transfers.json', transfers);
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
      this.writeJSON('transfers.json', transfers);
    }
  }

  // BLS Config
  getBlsConfig(): any {
    const filePath = path.join(this.dataDir, 'bls-config.json');
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }
}