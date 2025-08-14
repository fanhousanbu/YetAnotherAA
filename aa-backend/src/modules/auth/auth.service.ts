import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from '../storage/storage.service';
import { EmailService } from './email.service';
import { PasskeyService } from './passkey.service';
import { WalletUtil } from '../../utils/wallet.util';
import { User } from '../../interfaces/user.interface';
import { AuthResponse } from '../../interfaces/auth.interface';

@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private storageService: StorageService,
    private emailService: EmailService,
    private passkeyService: PasskeyService,
  ) {}

  async sendVerificationCode(email: string): Promise<AuthResponse> {
    try {
      const result = await this.emailService.sendVerificationCode(email);
      return {
        success: result.success,
        message: result.message,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to send verification code',
      };
    }
  }

  async verifyEmail(email: string, code: string): Promise<AuthResponse> {
    try {
      const result = await this.emailService.verifyCode(email, code);
      return {
        success: result.success,
        message: result.message,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to verify email',
      };
    }
  }

  async beginPasskeyRegistration(email: string, verificationCode: string): Promise<any> {
    // Verify email first
    const emailVerification = await this.emailService.verifyCode(email, verificationCode);
    if (!emailVerification.success) {
      throw new Error('Email verification failed');
    }

    // Check if user already exists
    const existingUser = await this.storageService.getUserByEmail(email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // Generate passkey registration options
    return this.passkeyService.generateRegistrationOptions(email);
  }

  async completePasskeyRegistration(challenge: string, credential: any): Promise<AuthResponse> {
    try {
      // Verify passkey registration
      const verification = await this.passkeyService.verifyRegistrationResponse(challenge, credential);
      if (!verification.success || !verification.email) {
        return {
          success: false,
          message: 'Passkey registration failed',
        };
      }

      // Create user
      const userId = await this.createUser(verification.email, {
        id: credential.id,
        publicKey: credential.response.attestationObject,
        counter: 0,
        createdAt: new Date(),
      });

      // Generate EOA wallet
      const wallet = WalletUtil.generateEOAWallet();
      const encryptedPrivateKey = WalletUtil.encryptAndStoreWallet(wallet.privateKey, verification.email);

      // Save wallet
      await this.storageService.saveWallet({
        id: uuidv4(),
        userId,
        email: verification.email,
        address: wallet.address,
        encryptedPrivateKey,
      });

      // Generate JWT token
      const accessToken = this.generateAccessToken(userId, verification.email);

      // Clean up email verification
      await this.emailService.cleanupExpiredVerifications();

      return {
        success: true,
        userId,
        accessToken,
        walletAddress: wallet.address,
        message: 'Registration completed successfully',
      };

    } catch (error) {
      console.error('Registration completion failed:', error);
      return {
        success: false,
        message: 'Registration failed',
      };
    }
  }

  async beginPasskeyLogin(email: string): Promise<any> {
    // Check if user exists
    const user = await this.storageService.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate passkey authentication options
    return this.passkeyService.generateAuthenticationOptions(email);
  }

  async completePasskeyLogin(challenge: string, credential: any): Promise<AuthResponse> {
    try {
      // Verify passkey authentication
      const verification = await this.passkeyService.verifyAuthenticationResponse(challenge, credential);
      if (!verification.success || !verification.email) {
        return {
          success: false,
          message: 'Authentication failed',
        };
      }

      // Get user
      const user = await this.storageService.getUserByEmail(verification.email);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Generate JWT token
      const accessToken = this.generateAccessToken(user.id, user.email);

      return {
        success: true,
        userId: user.id,
        accessToken,
        message: 'Login successful',
      };

    } catch (error) {
      console.error('Login completion failed:', error);
      return {
        success: false,
        message: 'Login failed',
      };
    }
  }

  async logout(sessionId: string): Promise<AuthResponse> {
    try {
      await this.storageService.deleteSession(sessionId);
      return {
        success: true,
        message: 'Logged out successfully',
      };
    } catch (error) {
      return {
        success: false,
        message: 'Logout failed',
      };
    }
  }

  private async createUser(email: string, passkeyCredential: any): Promise<string> {
    const userData: Partial<User> = {
      email,
      passkeyCredentials: [passkeyCredential],
    };

    return this.storageService.saveUser(userData);
  }

  private generateAccessToken(userId: string, email: string): string {
    const payload = { sub: userId, email };
    return this.jwtService.sign(payload);
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.storageService.getUserById(userId);
  }
}