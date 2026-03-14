import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import axios, { AxiosInstance } from "axios";

// ── Types ────────────────────────────────────────────────────────

export interface LegacyPasskeyAssertion {
  AuthenticatorData: string;
  ClientDataHash: string;
  Signature: string;
}

export interface KmsCreateKeyResponse {
  KeyMetadata: {
    KeyId: string;
    Arn: string;
    CreationDate: string;
    Enabled: boolean;
    Description: string;
    KeyUsage: string;
    KeySpec: string;
    Origin: string;
    Address?: string;
  };
  Mnemonic: string;
  Address?: string;
  Status?: string;
}

export interface KmsSignHashResponse {
  Signature: string;
}

export interface KmsKeyStatusResponse {
  KeyId: string;
  Status: "creating" | "deriving" | "ready" | "error";
  Address?: string;
  PublicKey?: string;
  Error?: string;
}

// ── Service ──────────────────────────────────────────────────────

@Injectable()
export class KmsService {
  private readonly logger = new Logger(KmsService.name);
  private readonly kmsEndpoint: string;
  private readonly isEnabled: boolean;
  private readonly http: AxiosInstance;

  constructor(private configService: ConfigService) {
    this.kmsEndpoint = this.configService.get<string>("kmsEndpoint") || "https://kms1.aastar.io";
    this.isEnabled = this.configService.get<boolean>("kmsEnabled") === true;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const apiKey = this.configService.get<string>("kmsApiKey");
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    this.http = axios.create({
      baseURL: this.kmsEndpoint,
      headers,
    });

    if (this.isEnabled) {
      this.logger.log(`KMS service enabled with endpoint: ${this.kmsEndpoint}`);
    } else {
      this.logger.log("KMS service disabled");
    }
  }

  isKmsEnabled(): boolean {
    return this.isEnabled;
  }

  private ensureEnabled(): void {
    if (!this.isEnabled) {
      throw new Error("KMS service is not enabled");
    }
  }

  /** POST with x-amz-target header (required for wallet/signing operations). */
  private async amzPost<T>(path: string, target: string, body: unknown): Promise<T> {
    // Log full curl command for debugging
    const url = `${this.kmsEndpoint}${path}`;
    const apiKey = this.configService.get<string>("kmsApiKey");
    const bodyJson = JSON.stringify(body);
    const curlParts = [
      `curl -v -X POST '${url}'`,
      `-H 'Content-Type: application/x-amz-json-1.1'`,
      `-H 'x-amz-target: ${target}'`,
    ];
    if (apiKey) {
      curlParts.push(`-H 'x-api-key: ${apiKey}'`);
    }
    curlParts.push(`-d '${bodyJson}'`);
    this.logger.warn(`[KMS CURL] ${curlParts.join(" \\\n  ")}`);

    const response = await this.http.post(path, body, {
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "x-amz-target": target,
      },
    });
    return response.data as T;
  }

  // ── Key Management ──────────────────────────────────────────────

  async createKey(description: string, passkeyPublicKey?: string): Promise<KmsCreateKeyResponse> {
    this.ensureEnabled();

    const payload: Record<string, unknown> = {
      Description: description,
      KeyUsage: "SIGN_VERIFY",
      KeySpec: "ECC_SECG_P256K1",
      Origin: "EXTERNAL_KMS",
    };

    if (passkeyPublicKey) {
      payload.PasskeyPublicKey = passkeyPublicKey;
    }

    this.logger.log(`KMS CreateKey: ${description}`);

    return this.amzPost("/CreateKey", "TrentService.CreateKey", payload);
  }

  async getKeyStatus(keyId: string): Promise<KmsKeyStatusResponse> {
    this.ensureEnabled();
    const response = await this.http.get("/KeyStatus", {
      params: { KeyId: keyId },
    });
    return response.data as KmsKeyStatusResponse;
  }

  async describeKey(keyId: string): Promise<any> {
    this.ensureEnabled();
    return this.amzPost("/DescribeKey", "TrentService.DescribeKey", { KeyId: keyId });
  }

  // ── Signing with Legacy Passkey Assertion ───────────────────────

  async signHashWithAssertion(
    address: string,
    hash: string,
    assertion: LegacyPasskeyAssertion
  ): Promise<KmsSignHashResponse> {
    this.ensureEnabled();

    const formattedHash = hash.startsWith("0x") ? hash : `0x${hash}`;

    this.logger.log(`KMS SignHash (Legacy assertion): address=${address}`);

    return this.amzPost("/SignHash", "TrentService.SignHash", {
      Address: address,
      Hash: formattedHash,
      Passkey: assertion,
    });
  }

  // ── Signing with WebAuthn Ceremony ──────────────────────────────

  async signHashWithWebAuthn(
    address: string,
    hash: string,
    challengeId: string,
    credential: unknown
  ): Promise<KmsSignHashResponse> {
    this.ensureEnabled();

    const formattedHash = hash.startsWith("0x") ? hash : `0x${hash}`;

    this.logger.log(`KMS SignHash (WebAuthn ceremony): address=${address}`);

    return this.amzPost("/SignHash", "TrentService.SignHash", {
      Address: address,
      Hash: formattedHash,
      WebAuthn: { ChallengeId: challengeId, Credential: credential },
    });
  }

  // ── WebAuthn Ceremonies ─────────────────────────────────────────

  async beginAuthentication(params: { Address?: string; KeyId?: string }): Promise<any> {
    this.ensureEnabled();
    const response = await this.http.post("/BeginAuthentication", params);
    return response.data;
  }

  // ── KMS Signer Factory ─────────────────────────────────────────

  /**
   * Create a KmsSigner backed by this service.
   * If assertionProvider is given, signing operations will use it to get assertions.
   * If not given, signing will use a no-op provider (will fail at KMS if assertion is required).
   */
  createKmsSigner(
    keyId: string,
    address: string,
    assertionProvider?: () => Promise<LegacyPasskeyAssertion>,
    provider?: ethers.Provider
  ): KmsSigner {
    this.ensureEnabled();
    return new KmsSigner(keyId, address, this, assertionProvider, provider);
  }
}

// ── KmsSigner (ethers.AbstractSigner backed by KmsService) ───────

export class KmsSigner extends ethers.AbstractSigner {
  constructor(
    private readonly keyId: string,
    private readonly _address: string,
    private readonly kmsService: KmsService,
    private readonly assertionProvider?: () => Promise<LegacyPasskeyAssertion>,
    provider?: ethers.Provider
  ) {
    super(provider);
  }

  async getAddress(): Promise<string> {
    return this._address;
  }

  private async getAssertion(): Promise<LegacyPasskeyAssertion> {
    if (!this.assertionProvider) {
      throw new Error("Passkey assertion is required for signing. Provide an assertionProvider.");
    }
    return this.assertionProvider();
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const messageBytes = typeof message === "string" ? ethers.toUtf8Bytes(message) : message;
    const messageHash = ethers.hashMessage(messageBytes);
    const assertion = await this.getAssertion();
    const signResponse = await this.kmsService.signHashWithAssertion(
      this._address,
      messageHash,
      assertion
    );
    return "0x" + signResponse.Signature;
  }

  async signTransaction(tx: ethers.TransactionRequest): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider is required for signing transactions");
    }

    const populated = await this.populateTransaction(tx);
    const unsignedTx = ethers.Transaction.from(populated);
    const txHash = unsignedTx.hash;
    if (!txHash) {
      throw new Error("Failed to compute transaction hash");
    }

    const assertion = await this.getAssertion();
    const signResponse = await this.kmsService.signHashWithAssertion(
      this._address,
      txHash,
      assertion
    );

    const sig = ethers.Signature.from("0x" + signResponse.Signature);
    unsignedTx.signature = sig;
    return unsignedTx.serialized;
  }

  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, any>
  ): Promise<string> {
    const hash = ethers.TypedDataEncoder.hash(domain, types, value);
    const assertion = await this.getAssertion();
    const signResponse = await this.kmsService.signHashWithAssertion(
      this._address,
      hash,
      assertion
    );
    return "0x" + signResponse.Signature;
  }

  connect(provider: ethers.Provider): KmsSigner {
    return new KmsSigner(
      this.keyId,
      this._address,
      this.kmsService,
      this.assertionProvider,
      provider
    );
  }
}
