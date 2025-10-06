import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "../database/database.service";
import { CryptoUtil } from "../common/utils/crypto.util";
import { KmsService } from "../kms/kms.service";
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
    private configService: ConfigService,
    private kmsService: KmsService
  ) {
    // Load WebAuthn configuration from environment variables
    this.rpName = this.configService.get<string>("webauthnRpName");
    this.rpID = this.configService.get<string>("webauthnRpId");
    this.origin = this.configService.get<string>("webauthnOrigin");
    this.expectedOrigin = this.origin;
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.databaseService.findUserByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    let walletAddress: string;
    let encryptedPrivateKey: string | undefined;
    let mnemonic: string | undefined;
    let kmsKeyId: string | undefined;
    let useKms = false;

    if (this.kmsService.isKmsEnabled()) {
      // Use KMS to create wallet
      useKms = true;
      const description = `wallet-${registerDto.email}-${Date.now()}`;

      console.log("════════════════════════════════════════════");
      console.log("🚀 Starting KMS Wallet Creation");
      console.log("════════════════════════════════════════════");
      console.log(`👤 User Email: ${registerDto.email}`);
      console.log(`📝 Description: ${description}`);
      console.log("════════════════════════════════════════════");

      const kmsResponse = await this.kmsService.createKey(description);

      kmsKeyId = kmsResponse.KeyMetadata.KeyId;
      // Use the address from KMS CreateKey response
      walletAddress = kmsResponse.KeyMetadata.Address || kmsResponse.Address;

      if (!walletAddress) {
        throw new Error("KMS CreateKey response did not include an address");
      }

      console.log("════════════════════════════════════════════");
      console.log("✅ KMS Wallet Created Successfully");
      console.log("════════════════════════════════════════════");
      console.log(`🔑 KMS Key ID: ${kmsKeyId}`);
      console.log(`💰 Wallet Address: ${walletAddress}`);
      console.log("════════════════════════════════════════════");
    } else {
      // Generate HDWallet locally (existing logic)
      const userWallet = ethers.Wallet.createRandom();
      const encryptionKey = this.configService.get<string>("userEncryptionKey");
      encryptedPrivateKey = CryptoUtil.encrypt(userWallet.privateKey, encryptionKey);
      walletAddress = userWallet.address;
      mnemonic = userWallet.mnemonic?.phrase;

      console.log("User Registration Debug (Local):");
      console.log("- Generated Wallet Address:", walletAddress);
      console.log("- Mnemonic:", mnemonic);
    }

    const user = {
      id: uuidv4(),
      email: registerDto.email,
      username: registerDto.username || registerDto.email.split("@")[0],
      password: hashedPassword,
      walletAddress,
      encryptedPrivateKey,
      mnemonic, // In production, this should also be encrypted
      kmsKeyId,
      useKms,
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

  async getUserWallet(userId: string): Promise<ethers.Wallet | any> {
    const user = await this.databaseService.findUserById(userId);
    if (!user) {
      throw new Error(`User not found for userId: ${userId}`);
    }

    if (user.useKms && user.kmsKeyId) {
      // Return KMS signer with stored address
      console.log("════════════════════════════════════════════");
      console.log("🔐 Creating KMS Signer");
      console.log("════════════════════════════════════════════");
      console.log(`👤 User ID: ${userId}`);
      console.log(`🔑 KMS Key ID: ${user.kmsKeyId}`);
      console.log(`💰 Wallet Address: ${user.walletAddress}`);
      console.log("════════════════════════════════════════════");

      const kmsSigner = this.kmsService.createKmsSigner(user.kmsKeyId, user.walletAddress);

      console.log("✅ KMS Signer created successfully");
      console.log("════════════════════════════════════════════");

      return kmsSigner;
    }

    if (!user.encryptedPrivateKey) {
      throw new Error(`User wallet not initialized for userId: ${userId}`);
    }

    const encryptionKey = this.configService.get<string>("userEncryptionKey");

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
        userVerification: "required",
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
        requireUserVerification: true,
      });

      if (!verification.verified) {
        throw new UnauthorizedException("Passkey registration failed");
      }

      // 创建用户（包含密码和钱包）
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);

      let walletAddress: string;
      let encryptedPrivateKey: string | undefined;
      let mnemonic: string | undefined;
      let kmsKeyId: string | undefined;
      let useKms = false;

      if (this.kmsService.isKmsEnabled()) {
        // Use KMS to create wallet
        useKms = true;
        const description = `wallet-${registerDto.email}-${Date.now()}`;
        const kmsResponse = await this.kmsService.createKey(description);

        kmsKeyId = kmsResponse.KeyMetadata.KeyId;
        // Use the address from KMS CreateKey response
        walletAddress = kmsResponse.KeyMetadata.Address || kmsResponse.Address;

        if (!walletAddress) {
          throw new Error("KMS CreateKey response did not include an address");
        }

        console.log("Passkey User Registration Debug (KMS):");
        console.log("- KMS Key ID:", kmsKeyId);
        console.log("- Wallet Address:", walletAddress);
      } else {
        // Generate HDWallet locally (existing logic)
        const userWallet = ethers.Wallet.createRandom();
        const encryptionKey = this.configService.get<string>("userEncryptionKey");
        encryptedPrivateKey = CryptoUtil.encrypt(userWallet.privateKey, encryptionKey);
        walletAddress = userWallet.address;
        mnemonic = userWallet.mnemonic?.phrase;

        console.log("Passkey User Registration Debug (Local):");
        console.log("- Generated Wallet Address:", walletAddress);
        console.log("- Mnemonic:", mnemonic);
      }

      const user = {
        id: uuidv4(),
        email: registerDto.email,
        username: registerDto.username || registerDto.email.split("@")[0],
        password: hashedPassword,
        walletAddress,
        encryptedPrivateKey,
        mnemonic, // In production, this should also be encrypted
        kmsKeyId,
        useKms,
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
      userVerification: "required",
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
        requireUserVerification: true,
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
        userVerification: "required",
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
        requireUserVerification: true,
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

      const { password: _password, ...result } = user;
      return {
        message: "Device passkey registered successfully",
        user: result,
        access_token: this.generateToken(user),
      };
    } catch {
      this.challengeStore.delete(`device_${registerDto.email}`);
      throw new UnauthorizedException("Passkey registration failed");
    }
  }

  // 交易Passkey验证流程 - 开始
  async beginTransactionVerification(userId: string) {
    const user = await this.databaseService.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const userPasskeys = await this.databaseService.findPasskeysByUserId(userId);
    if (userPasskeys.length === 0) {
      throw new UnauthorizedException("No passkey registered for this account");
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpID,
      userVerification: "required",
      allowCredentials: userPasskeys.map(passkey => ({
        id: passkey.credentialId,
        transports: passkey.transports || [],
      })),
    });

    // 使用challenge作为key存储临时数据
    this.challengeStore.set(`tx_${userId}_${options.challenge}`, options.challenge);

    return options;
  }

  // 交易Passkey验证流程 - 完成
  async completeTransactionVerification(userId: string, credential: any) {
    const credentialId = credential.id || credential.rawId;
    const passkey = await this.databaseService.findPasskeyByCredentialId(credentialId);

    if (!passkey) {
      throw new UnauthorizedException("Passkey not found");
    }

    if (passkey.userId !== userId) {
      throw new UnauthorizedException("Passkey does not belong to this user");
    }

    const expectedChallenge = this.challengeStore.get(
      `tx_${userId}_${
        credential.response.clientDataJSON
          ? JSON.parse(atob(credential.response.clientDataJSON)).challenge
          : ""
      }`
    );

    if (!expectedChallenge) {
      throw new UnauthorizedException("Invalid verification session");
    }

    try {
      const verification = await verifyAuthenticationResponse({
        response: credential,
        expectedChallenge,
        expectedOrigin: this.expectedOrigin,
        expectedRPID: this.rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: passkey.counter,
          transports: passkey.transports,
        },
        requireUserVerification: true,
      });

      if (!verification.verified) {
        throw new UnauthorizedException("Passkey verification failed");
      }

      // 更新counter
      await this.databaseService.updatePasskey(passkey.credentialId, {
        counter: verification.authenticationInfo.newCounter,
      });

      // 清除challenge
      this.challengeStore.delete(`tx_${userId}_${expectedChallenge}`);

      return {
        verified: true,
        message: "Transaction verification successful",
      };
    } catch {
      throw new UnauthorizedException("Passkey verification failed");
    }
  }
}
