import { Injectable } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";

export interface AddressBookEntry {
  address: string;
  name?: string; // User-provided name for the address
  lastUsed: string; // ISO timestamp
  usageCount: number;
  firstUsed: string; // ISO timestamp
  transactionHashes: string[]; // Recent successful transaction hashes
}

@Injectable()
export class AddressBookService {
  private readonly dataDir = path.join(process.cwd(), "data");

  constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private getUserAddressBookPath(userId: string): string {
    return path.join(this.dataDir, `address-book-${userId}.json`);
  }

  private async loadUserAddressBook(userId: string): Promise<AddressBookEntry[]> {
    const filePath = this.getUserAddressBookPath(userId);
    if (!fs.existsSync(filePath)) {
      return [];
    }

    try {
      const data = fs.readFileSync(filePath, "utf8");
      return JSON.parse(data);
    } catch (error) {
      console.error("Error loading user address book:", error);
      return [];
    }
  }

  private async saveUserAddressBook(
    userId: string,
    addressBook: AddressBookEntry[]
  ): Promise<void> {
    const filePath = this.getUserAddressBookPath(userId);
    try {
      fs.writeFileSync(filePath, JSON.stringify(addressBook, null, 2));
    } catch (error) {
      console.error("Error saving user address book:", error);
      throw new Error("Failed to save address book");
    }
  }

  /**
   * Record a successful transfer to an address
   */
  async recordSuccessfulTransfer(
    userId: string,
    toAddress: string,
    transactionHash: string
  ): Promise<void> {
    const addressBook = await this.loadUserAddressBook(userId);
    const now = new Date().toISOString();

    // Find existing entry or create new one
    let entry = addressBook.find(e => e.address.toLowerCase() === toAddress.toLowerCase());

    if (entry) {
      // Update existing entry
      entry.lastUsed = now;
      entry.usageCount += 1;
      entry.transactionHashes.unshift(transactionHash);
      // Keep only the last 5 transaction hashes
      entry.transactionHashes = entry.transactionHashes.slice(0, 5);
    } else {
      // Create new entry
      entry = {
        address: toAddress,
        lastUsed: now,
        firstUsed: now,
        usageCount: 1,
        transactionHashes: [transactionHash],
      };
      addressBook.push(entry);
    }

    await this.saveUserAddressBook(userId, addressBook);
  }

  /**
   * Get user's address book (frequently used addresses)
   */
  async getAddressBook(userId: string): Promise<AddressBookEntry[]> {
    const addressBook = await this.loadUserAddressBook(userId);

    // Sort by usage frequency and recency
    return addressBook.sort((a, b) => {
      // First sort by usage count (descending)
      if (a.usageCount !== b.usageCount) {
        return b.usageCount - a.usageCount;
      }
      // Then by last used (most recent first)
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    });
  }

  /**
   * Add or update a name for an address
   */
  async setAddressName(userId: string, address: string, name: string): Promise<void> {
    const addressBook = await this.loadUserAddressBook(userId);

    let entry = addressBook.find(e => e.address.toLowerCase() === address.toLowerCase());

    if (entry) {
      entry.name = name;
    } else {
      // Create new entry with name only
      entry = {
        address,
        name,
        lastUsed: new Date().toISOString(),
        firstUsed: new Date().toISOString(),
        usageCount: 0,
        transactionHashes: [],
      };
      addressBook.push(entry);
    }

    await this.saveUserAddressBook(userId, addressBook);
  }

  /**
   * Remove an address from the address book
   */
  async removeAddress(userId: string, address: string): Promise<boolean> {
    const addressBook = await this.loadUserAddressBook(userId);
    const originalLength = addressBook.length;

    const filteredAddressBook = addressBook.filter(
      e => e.address.toLowerCase() !== address.toLowerCase()
    );

    if (filteredAddressBook.length < originalLength) {
      await this.saveUserAddressBook(userId, filteredAddressBook);
      return true;
    }

    return false;
  }

  /**
   * Search addresses by partial match
   */
  async searchAddresses(userId: string, query: string): Promise<AddressBookEntry[]> {
    const addressBook = await this.getAddressBook(userId);
    const lowerQuery = query.toLowerCase();

    return addressBook.filter(
      entry =>
        entry.address.toLowerCase().includes(lowerQuery) ||
        (entry.name && entry.name.toLowerCase().includes(lowerQuery))
    );
  }
}
