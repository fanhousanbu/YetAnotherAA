import { Injectable, UnauthorizedException, ConflictException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { DatabaseService } from "../database/database.service";
import * as bcrypt from "bcrypt";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { PasskeyRegisterBeginDto, PasskeyRegisterDto } from "./dto/passkey-register.dto";
import { PasskeyLoginBeginDto, PasskeyLoginDto } from "./dto/passkey-login.dto";
import { DevicePasskeyBeginDto, DevicePasskeyRegisterDto } from "./dto/device-passkey.dto";
import { v4 as uuidv4 } from "uuid";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  GenerateRegistrationOptionsOpts,
  VerifyRegistrationResponseOpts,
  GenerateAuthenticationOptionsOpts,
  VerifyAuthenticationResponseOpts,
} from "@simplewebauthn/server";

@Injectable()
export class AuthService {
  private readonly rpName = "AAstar";
  private readonly rpID = "localhost";
  private readonly origin = "http://localhost:8080";
  private readonly expectedOrigin = this.origin;
  private challengeStore = new Map<string, string>();

  constructor(
    private databaseService: DatabaseService,
    private jwtService: JwtService
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = this.databaseService.findUserByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = {
      id: uuidv4(),
      email: registerDto.email,
      username: registerDto.username || registerDto.email.split("@")[0],
      password: hashedPassword,
      createdAt: new Date().toISOString(),
    };

    this.databaseService.saveUser(user);

    const { password, ...result } = user;
    return {
      user: result,
      access_token: this.generateToken(user),
    };
  }

  async login(loginDto: LoginDto) {
    const user = this.databaseService.findUserByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const { password, ...result } = user;
    return {
      user: result,
      access_token: this.generateToken(user),
    };
  }

  async validateUser(email: string, pass: string): Promise<any> {
    const user = this.databaseService.findUserByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async getProfile(userId: string) {
    const user = this.databaseService.findUserById(userId);
    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    const { password, ...result } = user;
    return result;
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
    const existingUser = this.databaseService.findUserByEmail(beginDto.email);
    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    const userId = uuidv4();
    const userPasskeys = this.databaseService.findPasskeysByUserId(userId);

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

    const existingUser = this.databaseService.findUserByEmail(registerDto.email);
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

      // 创建用户（包含密码）
      const hashedPassword = await bcrypt.hash(registerDto.password, 10);
      const user = {
        id: uuidv4(),
        email: registerDto.email,
        username: registerDto.username || registerDto.email.split("@")[0],
        password: hashedPassword,
        createdAt: new Date().toISOString(),
      };

      this.databaseService.saveUser(user);

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

      this.databaseService.savePasskey(passkey);

      // 清除challenge
      this.challengeStore.delete(registerDto.email);

      const { password, ...result } = user;
      return {
        user: result,
        access_token: this.generateToken(user),
      };
    } catch (error) {
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
    const passkey = this.databaseService.findPasskeyByCredentialId(credentialId);

    if (!passkey) {
      throw new UnauthorizedException("Passkey not found");
    }

    const user = this.databaseService.findUserById(passkey.userId);
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
      this.databaseService.updatePasskey(passkey.credentialId, {
        counter: verification.authenticationInfo.newCounter,
      });

      // 清除challenge
      this.challengeStore.delete(`login_${expectedChallenge}`);

      const { password, ...result } = user;
      return {
        user: result,
        access_token: this.generateToken(user),
      };
    } catch (error) {
      throw new UnauthorizedException("Passkey authentication failed");
    }
  }

  // 新设备Passkey注册流程 - 开始
  async beginDevicePasskeyRegistration(beginDto: DevicePasskeyBeginDto) {
    const user = this.databaseService.findUserByEmail(beginDto.email);
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

    const userPasskeys = this.databaseService.findPasskeysByUserId(user.id);

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
    const user = this.databaseService.findUserByEmail(registerDto.email);
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

      this.databaseService.savePasskey(passkey);

      // 清除challenge
      this.challengeStore.delete(`device_${registerDto.email}`);

      return {
        message: "Device passkey registered successfully",
      };
    } catch (error) {
      this.challengeStore.delete(`device_${registerDto.email}`);
      throw new UnauthorizedException("Passkey registration failed");
    }
  }
}
