import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../database/database.service";
import { CryptoUtil } from "../common/utils/crypto.util";
import { ethers } from "ethers";
import * as bcrypt from "bcrypt";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { PasskeyRegisterBeginDto, PasskeyRegisterDto } from "./dto/passkey-register.dto";
import { PasskeyLoginDto } from "./dto/passkey-login.dto";
import { DevicePasskeyBeginDto, DevicePasskeyRegisterDto } from "./dto/device-passkey.dto";
import { v4 as uuidv4 } from "uuid";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

@Injectable()
export class AuthService {
  private readonly rpName: string;
  private readonly rpID: string;
  private readonly origin: string;
  private readonly expectedOrigin: string;
  private challengeStore = new Map<string, string>();

  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {
    // Load WebAuthn configuration from environment variables
    this.rpName = this.configService.get<string>("WEBAUTHN_RP_NAME") || "AAstar";
    this.rpID = this.configService.get<string>("WEBAUTHN_RP_ID") || "localhost";
    this.origin = this.configService.get<string>("WEBAUTHN_ORIGIN") || "http://localhost:8080";
    this.expectedOrigin = this.origin;
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.databaseService.findUserByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Generate HDWallet for the user
    const userWallet = ethers.Wallet.createRandom();
    const encryptionKey =
      this.configService.get<string>("USER_ENCRYPTION_KEY") || "default-key-change-in-production";
    const encryptedPrivateKey = CryptoUtil.encrypt(userWallet.privateKey, encryptionKey);

    console.log("User Registration Debug:");
    console.log("- Generated Wallet Address:", userWallet.address);
    console.log("- Mnemonic:", userWallet.mnemonic?.phrase);

    const user = {
      id: uuidv4(),
      email: registerDto.email,
      username: registerDto.username || registerDto.email.split("@")[0],
      password: hashedPassword,
      walletAddress: userWallet.address,
      encryptedPrivateKey,
      mnemonic: userWallet.mnemonic?.phrase, // In production, this should also be encrypted
      createdAt: new Date().toISOString(),
    };

    await this.databaseService.saveUser(user);

    const { password: _password, encryptedPrivateKey: _encryptedPrivateKey, ...result } = user;
    return {
      user: result,
      access_token: this.generateToken(user),
    };
  }

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

  async getProfile(userId: string) {
    const user = await this.databaseService.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    const { password: _password, ...result } = user;
    return result;
  }

  async getUserWallet(userId: string): Promise<ethers.Wallet> {
    const user = await this.databaseService.findUserById(userId);
    if (!user) {
      throw new Error(`User not found for userId: ${userId}`);
    }
    
    if (!user.encryptedPrivateKey) {
      throw new Error(`User wallet not initialized for userId: ${userId}`);
    }

    const encryptionKey = this.configService.get<string>("USER_ENCRYPTION_KEY");
    if (!encryptionKey || encryptionKey === "default-key-change-in-production") {
      throw new Error("USER_ENCRYPTION_KEY not properly configured");
    }

    try {
      const privateKey = CryptoUtil.decrypt(user.encryptedPrivateKey, encryptionKey);
      
      // Validate that the decrypted private key is valid
      if (!privateKey || !privateKey.startsWith("0x") || privateKey.length !== 66) {
        throw new Error("Decrypted private key is invalid");
      }
      
      const wallet = new ethers.Wallet(privateKey);
      
      // Verify that the wallet address matches the stored address
      if (wallet.address.toLowerCase() !== user.walletAddress.toLowerCase()) {
        throw new Error(
          `Wallet address mismatch! Expected: ${user.walletAddress}, Got: ${wallet.address}`
        );
      }
      
      return wallet;
    } catch (error) {
      // Log the error for debugging but don't expose sensitive information
      console.error(`Failed to get user wallet for userId ${userId}:`, error.message);
      
      // IMPORTANT: Never fall back to a default wallet!
      // Always throw an error to prevent security issues
      throw new Error(`Failed to decrypt user wallet: ${error.message}`);
    }
  }

  private generateToken(user: any) {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };
    return this.jwtService.sign(payload);
  }

  // Passkey注册流程 - 开始
  async beginPasskeyRegistration(beginDto: PasskeyRegisterBeginDto) {
    const existingUser = await this.databaseService.findUserByEmail(beginDto.email);
    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    const userId = uuidv4();
    const userPasskeys = await this.databaseService.findPasskeysByUserId(userId);

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userName: beginDto.email,
      userID: new TextEncoder().encode(userId),
      userDisplayName: beginDto.username || beginDto.email.split("@")[0],
      attestationType: "none",
      excludeCredentials: userPasskeys.map(passkey => ({
        id: passkey.credentialId,
        transports: passkey.transports || [],
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
    });

    this.challengeStore.set(beginDto.email, options.challenge);

    return {
      options,
      userId,
    };
  }

  // Passkey注册流程 - 完成
  async completePasskeyRegistration(registerDto: PasskeyRegisterDto) {
    const expectedChallenge = this.challengeStore.get(registerDto.email);
    if (!expectedChallenge) {
      throw new UnauthorizedException("Invalid registration session");
    }

    const existingUser = await this.databaseService.findUserByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    try {
      const verification = await verifyRegistrationResponse({
        response: registerDto.credential,
        expectedChallenge,
        expectedOrigin: this.expectedOrigin,
        expectedRPID: this.rpID,
        requireUserVerification: false,
      });

      if (!verification.verified) {
        throw new UnauthorizedException("Passkey registration failed");
      }

      // 创建用户（包含密码和钱包）
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);

      // Generate HDWallet for the user (same as regular registration)
      const userWallet = ethers.Wallet.createRandom();
      const encryptionKey =
        this.configService.get<string>("USER_ENCRYPTION_KEY") || "default-key-change-in-production";
      const encryptedPrivateKey = CryptoUtil.encrypt(userWallet.privateKey, encryptionKey);

      console.log("Passkey User Registration Debug:");
      console.log("- Generated Wallet Address:", userWallet.address);
      console.log("- Mnemonic:", userWallet.mnemonic?.phrase);

      const user = {
        id: uuidv4(),
        email: registerDto.email,
        username: registerDto.username || registerDto.email.split("@")[0],
        password: hashedPassword,
        walletAddress: userWallet.address,
        encryptedPrivateKey,
        mnemonic: userWallet.mnemonic?.phrase, // In production, this should also be encrypted
        createdAt: new Date().toISOString(),
      };

      await this.databaseService.saveUser(user);

      // 保存passkey
      const passkey = {
        id: uuidv4(),
        userId: user.id,
        credentialId: verification.registrationInfo.credential.id,
        publicKey: Array.from(verification.registrationInfo.credential.publicKey),
        counter: verification.registrationInfo.credential.counter,
        deviceType: verification.registrationInfo.credentialDeviceType,
        backedUp: verification.registrationInfo.credentialBackedUp,
        transports: registerDto.credential.response.transports || [],
        createdAt: new Date().toISOString(),
      };

      await this.databaseService.savePasskey(passkey);

      // 清除challenge
      this.challengeStore.delete(registerDto.email);

      const { password: _password, ...result } = user;
      return {
        user: result,
        access_token: this.generateToken(user),
      };
    } catch {
      this.challengeStore.delete(registerDto.email);
      throw new UnauthorizedException("Passkey registration failed");
    }
  }

  // Passkey登录流程 - 开始
  async beginPasskeyLogin() {
    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: "preferred",
    });

    // 使用challenge作为key存储临时数据
    this.challengeStore.set(`login_${options.challenge}`, options.challenge);

    return options;
  }

  // Passkey登录流程 - 完成
  async completePasskeyLogin(loginDto: PasskeyLoginDto) {
    const credentialId = loginDto.credential.id || loginDto.credential.rawId;
    const passkey = await this.databaseService.findPasskeyByCredentialId(credentialId);

    if (!passkey) {
      throw new UnauthorizedException("Passkey not found");
    }

    const user = await this.databaseService.findUserById(passkey.userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const expectedChallenge = this.challengeStore.get(
      `login_${
        loginDto.credential.response.clientDataJSON
          ? JSON.parse(atob(loginDto.credential.response.clientDataJSON)).challenge
          : ""
      }`
    );

    if (!expectedChallenge) {
      throw new UnauthorizedException("Invalid login session");
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response: loginDto.credential,
        expectedChallenge,
        expectedOrigin: this.expectedOrigin,
        expectedRPID: this.rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: passkey.counter,
          transports: passkey.transports,
        },
        requireUserVerification: false,
      });

      if (!verification.verified) {
        throw new UnauthorizedException("Passkey authentication failed");
      }

      // 更新counter
      await this.databaseService.updatePasskey(passkey.credentialId, {
        counter: verification.authenticationInfo.newCounter,
      });

      // 清除challenge
      this.challengeStore.delete(`login_${expectedChallenge}`);

      const { password: _password, ...result } = user;
      return {
        user: result,
        access_token: this.generateToken(user),
      };
    } catch {
      throw new UnauthorizedException("Passkey authentication failed");
    }
  }

  // 新设备Passkey注册流程 - 开始
  async beginDevicePasskeyRegistration(beginDto: DevicePasskeyBeginDto) {
    const user = await this.databaseService.findUserByEmail(beginDto.email);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    // 对于仅使用Passkey注册的用户，可能没有密码
    // 在这种情况下，我们需要临时设置一个密码，或者使用其他验证方式
    // 为了简化，这里要求用户必须有密码才能在新设备注册passkey
    if (!user.password) {
      throw new UnauthorizedException(
        "This account was created with passkey only. Please use an existing device with passkey to access your account, or contact support to set up a password."
      );
    }

    const isPasswordValid = await bcrypt.compare(beginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const userPasskeys = await this.databaseService.findPasskeysByUserId(user.id);

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpID,
      userName: user.email,
      userID: new TextEncoder().encode(user.id),
      userDisplayName: user.username,
      attestationType: "none",
      excludeCredentials: userPasskeys.map(passkey => ({
        id: passkey.credentialId,
        transports: passkey.transports || [],
      })),
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "preferred",
      },
    });

    this.challengeStore.set(`device_${beginDto.email}`, options.challenge);

    return options;
  }

  // 新设备Passkey注册流程 - 完成
  async completeDevicePasskeyRegistration(registerDto: DevicePasskeyRegisterDto) {
    const user = await this.databaseService.findUserByEmail(registerDto.email);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const expectedChallenge = this.challengeStore.get(`device_${registerDto.email}`);
    if (!expectedChallenge) {
      throw new UnauthorizedException("Invalid registration session");
    }

    // 再次验证密码
    if (!user.password) {
      throw new UnauthorizedException("Password authentication not available for this user");
    }

    const isPasswordValid = await bcrypt.compare(registerDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    try {
      const verification = await verifyRegistrationResponse({
        response: registerDto.credential,
        expectedChallenge,
        expectedOrigin: this.expectedOrigin,
        expectedRPID: this.rpID,
        requireUserVerification: false,
      });

      if (!verification.verified) {
        throw new UnauthorizedException("Passkey registration failed");
      }

      // 保存passkey
      const passkey = {
        id: uuidv4(),
        userId: user.id,
        credentialId: verification.registrationInfo.credential.id,
        publicKey: Array.from(verification.registrationInfo.credential.publicKey),
        counter: verification.registrationInfo.credential.counter,
        deviceType: verification.registrationInfo.credentialDeviceType,
        backedUp: verification.registrationInfo.credentialBackedUp,
        transports: registerDto.credential.response.transports || [],
        createdAt: new Date().toISOString(),
      };

      await this.databaseService.savePasskey(passkey);

      // 清除challenge
      this.challengeStore.delete(`device_${registerDto.email}`);

      return {
        message: "Device passkey registered successfully",
      };
    } catch {
      this.challengeStore.delete(`device_${registerDto.email}`);
      throw new UnauthorizedException("Passkey registration failed");
    }
  }
}
