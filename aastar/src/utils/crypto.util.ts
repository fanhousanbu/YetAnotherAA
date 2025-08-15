import { randomBytes, scrypt, createCipheriv, createDecipheriv } from 'crypto';
import * as bcrypt from 'bcrypt';

export class CryptoUtil {
  static generateRandomCode(length: number = 6): string {
    const chars = '0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  static generateChallenge(): string {
    return randomBytes(32).toString('base64url');
  }

  static generateUserId(): string {
    return randomBytes(32).toString('base64url');
  }

  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static encryptPrivateKey(privateKey: string, password: string): string {
    const algorithm = 'aes-256-cbc';
    const iv = randomBytes(16);
    const key = this.deriveKey(password);
    
    const cipher = createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return iv.toString('hex') + ':' + encrypted;
  }

  static decryptPrivateKey(encryptedKey: string, password: string): string {
    const algorithm = 'aes-256-cbc';
    const parts = encryptedKey.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    const key = this.deriveKey(password);
    
    const decipher = createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private static deriveKey(password: string): Buffer {
    // Simple key derivation - in production, use PBKDF2 or scrypt
    return Buffer.from(password.padEnd(32, '0').slice(0, 32));
  }

  static base64urlEncode(buffer: Buffer): string {
    return buffer.toString('base64url');
  }

  static base64urlDecode(str: string): Buffer {
    return Buffer.from(str, 'base64url');
  }
}