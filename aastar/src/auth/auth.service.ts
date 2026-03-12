import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../database/database.service";
import { KmsService } from "../kms/kms.service";
import { ethers } from "ethers";
import * as bcrypt from "bcrypt";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";

@Injectable()
export class AuthService {
  /** Temporary store for KMS login challenges (address → { loginHash, expiresAt }) */
  private loginChallengeStore = new Map<
    string,
    { loginHash: string; expiresAt: number }
  >();

  /** Cleanup interval for expired challenges */
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private kmsService: KmsService,
  ) {
    // Clean up expired challenges every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanupExpiredChallenges(), 60_000);
  }

  // ── User Registration (password-based, no wallet) ──────────────

  async register(registerDto: RegisterDto) {
    const existingUser = await this.databaseService.findUserByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = {
      id: uuidv4(),
      email: registerDto.email,
      username: registerDto.username || registerDto.email.split("@")[0],
      password: hashedPassword,
      walletAddress: undefined,
      kmsKeyId: undefined,
      kmsCredentialId: undefined,
      createdAt: new Date().toISOString(),
    };

    await this.databaseService.saveUser(user);

    const { password: _password, ...result } = user;
    return {
      user: result,
      access_token: this.generateToken(user),
    };
  }

  // ── Password Login (fallback) ──────────────────────────────────

  async login(loginDto: LoginDto) {
    const user = await this.databaseService.findUserByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const { password: _password, ...result } = user;
    return {
      user: result,
      access_token: this.generateToken(user),
    };
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.databaseService.findUserByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password: _password, ...result } = user;
      return result;
    }
    return null;
  }

  // ── Profile ────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const user = await this.databaseService.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    const { password: _password, ...result } = user;
    return result;
  }

  // ── KMS Login Flow ─────────────────────────────────────────────

  /**
   * Step 1: Generate a random login challenge for KMS Passkey login.
   * Returns the loginHash and the user's wallet address (for frontend to
   * call KMS BeginAuthentication).
   */
  async generateLoginChallenge(email: string) {
    const user = await this.databaseService.findUserByEmail(email);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (!user.walletAddress) {
      throw new BadRequestException(
        "User has no wallet linked. Please register a Passkey first.",
      );
    }

    // Generate random 32-byte login hash
    const loginHash = "0x" + crypto.randomBytes(32).toString("hex");

    // Store with 5-minute expiry
    this.loginChallengeStore.set(user.walletAddress.toLowerCase(), {
      loginHash,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return {
      loginHash,
      walletAddress: user.walletAddress,
    };
  }

  /**
   * Step 2: Verify KMS login. Backend calls KMS SignHash with the WebAuthn
   * credential to sign the loginHash, then verifies the signature matches
   * the user's wallet address.
   */
  async verifyKmsLogin(
    address: string,
    challengeId: string,
    credential: unknown,
  ) {
    const normalizedAddress = address.toLowerCase();
    const challenge = this.loginChallengeStore.get(normalizedAddress);

    if (!challenge) {
      throw new UnauthorizedException("No pending login challenge for this address");
    }

    if (Date.now() > challenge.expiresAt) {
      this.loginChallengeStore.delete(normalizedAddress);
      throw new UnauthorizedException("Login challenge expired");
    }

    try {
      // Use KMS to sign the loginHash with the WebAuthn credential
      const signResponse = await this.kmsService.signHashWithWebAuthn(
        address,
        challenge.loginHash,
        challengeId,
        credential,
      );

      // Verify the signature matches the expected address
      const sig = ethers.Signature.from("0x" + signResponse.Signature);
      const recoveredAddress = ethers.recoverAddress(challenge.loginHash, sig);

      if (recoveredAddress.toLowerCase() !== normalizedAddress) {
        throw new UnauthorizedException("Signature address mismatch");
      }

      // Clean up challenge
      this.loginChallengeStore.delete(normalizedAddress);

      // Find user by wallet address
      const user = await this.databaseService.findUserByWalletAddress(address);
      if (!user) {
        throw new UnauthorizedException("No user found for this wallet address");
      }

      const { password: _password, ...result } = user;
      return {
        user: result,
        access_token: this.generateToken(user),
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException(`KMS login verification failed: ${error.message}`);
    }
  }

  // ── Wallet Linking ─────────────────────────────────────────────

  /**
   * Link a KMS wallet to a user account. Called after KMS key creation
   * and address derivation are complete.
   */
  async linkWallet(
    userId: string,
    kmsKeyId: string,
    walletAddress: string,
    credentialId?: string,
  ) {
    const user = await this.databaseService.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    await this.databaseService.updateUser(userId, {
      kmsKeyId,
      walletAddress,
      kmsCredentialId: credentialId,
    });

    return {
      message: "Wallet linked successfully",
      walletAddress,
      kmsKeyId,
    };
  }

  // ── Wallet Access (for SDK signer adapter) ─────────────────────

  /**
   * Get a KMS signer for the user. Requires the user to have a linked wallet.
   * The returned signer needs a Passkey assertion for each signing operation.
   */
  async getUserWallet(userId: string, assertionProvider?: () => Promise<any>): Promise<any> {
    const user = await this.databaseService.findUserById(userId);
    if (!user) {
      throw new Error(`User not found for userId: ${userId}`);
    }

    if (!user.walletAddress || !user.kmsKeyId) {
      throw new Error(
        `User wallet not initialized for userId: ${userId}. Link a KMS wallet first.`,
      );
    }

    return this.kmsService.createKmsSigner(
      user.kmsKeyId,
      user.walletAddress,
      assertionProvider,
    );
  }

  /**
   * Ensure user has a KMS wallet linked. For backward compatibility,
   * returns a KmsSigner if wallet exists, but NOTE: signing will fail
   * without a proper assertion provider.
   */
  async ensureUserWallet(userId: string): Promise<any> {
    const user = await this.databaseService.findUserById(userId);
    if (!user) {
      throw new Error(`User not found for userId: ${userId}`);
    }

    if (user.walletAddress && user.kmsKeyId) {
      // Return existing KMS signer (assertion must be provided later)
      return this.kmsService.createKmsSigner(user.kmsKeyId, user.walletAddress);
    }

    throw new Error(
      `User has no KMS wallet. Register a Passkey via KMS and call linkWallet first.`,
    );
  }

  // ── Internal ───────────────────────────────────────────────────

  private generateToken(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };
    return this.jwtService.sign(payload);
  }

  private cleanupExpiredChallenges() {
    const now = Date.now();
    for (const [key, value] of this.loginChallengeStore) {
      if (now > value.expiresAt) {
        this.loginChallengeStore.delete(key);
      }
    }
  }
}
