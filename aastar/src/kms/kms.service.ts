import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";
import axios from "axios";

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
  };
  Mnemonic: string;
  Address?: string; // Will be computed from public key
}

export interface KmsSignResponse {
  Signature: string;
  TransactionHash: string;
}

@Injectable()
export class KmsService {
  private readonly logger = new Logger(KmsService.name);
  private readonly kmsEndpoint: string;
  private readonly isEnabled: boolean;

  constructor(private configService: ConfigService) {
    this.kmsEndpoint = this.configService.get<string>("kmsEndpoint") || "https://kms.aastar.io";
    this.isEnabled = this.configService.get<boolean>("kmsEnabled") === true;

    if (this.isEnabled) {
      this.logger.log(`KMS service enabled with endpoint: ${this.kmsEndpoint}`);
    } else {
      this.logger.log("KMS service disabled, using local wallet generation");
    }
  }

  /**
   * Check if KMS service is enabled
   */
  isKmsEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Create a new key in KMS
   */
  async createKey(description: string): Promise<KmsCreateKeyResponse> {
    if (!this.isEnabled) {
      throw new Error("KMS service is not enabled");
    }

    try {
      this.logger.log(`Creating KMS key with description: ${description}`);

      const response = await axios.post(
        `${this.kmsEndpoint}/CreateKey`,
        {
          Description: description,
          KeyUsage: "SIGN_VERIFY",
          KeySpec: "ECC_SECG_P256K1",
          Origin: "AWS_KMS",
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-amz-target": "TrentService.CreateKey",
          },
        }
      );

      const kmsResponse = response.data as KmsCreateKeyResponse;

      // Derive the Ethereum address from the key (requires getting public key)
      // For now, we'll need to get this from the first sign operation or add a GetPublicKey endpoint

      this.logger.log(`KMS key created successfully: ${kmsResponse.KeyMetadata.KeyId}`);
      return kmsResponse;
    } catch (error) {
      this.logger.error(`Failed to create KMS key: ${error.message}`);
      throw new Error(`KMS key creation failed: ${error.message}`);
    }
  }

  /**
   * Sign a message or transaction using KMS
   */
  async sign(
    keyId: string,
    message: string,
    derivationPath: string = "m/44'/60'/0'/0/0"
  ): Promise<KmsSignResponse> {
    if (!this.isEnabled) {
      throw new Error("KMS service is not enabled");
    }

    try {
      this.logger.log(`Signing with KMS key ${keyId}`);

      // Convert message to base64 if it's not already
      const messageBase64 = this.isBase64(message)
        ? message
        : Buffer.from(message).toString("base64");

      const response = await axios.post(
        `${this.kmsEndpoint}/Sign`,
        {
          KeyId: keyId,
          DerivationPath: derivationPath,
          Message: messageBase64,
          SigningAlgorithm: "ECC_SECG_P256K1",
        },
        {
          headers: {
            Accept: "*/*",
            "Content-Type": "application/json",
            "x-amz-target": "TrentService.Sign",
          },
        }
      );

      const signResponse = response.data as KmsSignResponse;
      this.logger.log(`Message signed successfully with KMS`);
      return signResponse;
    } catch (error) {
      this.logger.error(`Failed to sign with KMS: ${error.message}`);
      throw new Error(`KMS signing failed: ${error.message}`);
    }
  }

  /**
   * Get the Ethereum address for a KMS key
   * Note: KMS might return different addresses for different messages due to internal implementation
   * We'll use a standard message for consistency
   */
  async getAddressForKey(
    keyId: string,
    derivationPath: string = "m/44'/60'/0'/0/0"
  ): Promise<string> {
    if (!this.isEnabled) {
      throw new Error("KMS service is not enabled");
    }

    try {
      // Use a standard message for address derivation
      const standardMessage = "Derive Ethereum Address";
      const messageBytes = ethers.toUtf8Bytes(standardMessage);
      const messageHash = ethers.hashMessage(messageBytes);

      const signResponse = await this.sign(
        keyId,
        messageHash.slice(2), // Remove 0x prefix
        derivationPath
      );

      // Recover address from signature
      const signature = "0x" + signResponse.Signature;
      const sig = ethers.Signature.from(signature);

      // Recover the address
      const recoveredAddress = ethers.recoverAddress(messageHash, sig);

      this.logger.log(`Derived address for KMS key ${keyId}: ${recoveredAddress}`);

      // Note: Due to KMS implementation, this address should be stored and reused
      // rather than re-derived each time
      return recoveredAddress;
    } catch (error) {
      this.logger.error(`Failed to get address for KMS key: ${error.message}`);
      throw new Error(`Failed to get KMS key address: ${error.message}`);
    }
  }

  /**
   * Create a signer that uses KMS for signing operations
   */
  createKmsSigner(keyId: string, provider?: ethers.Provider): KmsSigner {
    if (!this.isEnabled) {
      throw new Error("KMS service is not enabled");
    }

    return new KmsSigner(keyId, this, provider);
  }

  private isBase64(str: string): boolean {
    try {
      return Buffer.from(str, "base64").toString("base64") === str;
    } catch {
      return false;
    }
  }
}

/**
 * Custom Signer implementation for KMS
 */
export class KmsSigner extends ethers.AbstractSigner {
  private address: string | null = null;

  constructor(
    private readonly keyId: string,
    private readonly kmsService: KmsService,
    provider?: ethers.Provider
  ) {
    super(provider);
  }

  async getAddress(): Promise<string> {
    if (!this.address) {
      this.address = await this.kmsService.getAddressForKey(this.keyId);
    }
    return this.address;
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const messageBytes = typeof message === "string" ? ethers.toUtf8Bytes(message) : message;

    const messageHash = ethers.hashMessage(messageBytes);
    const signResponse = await this.kmsService.sign(
      this.keyId,
      messageHash.slice(2) // Remove 0x prefix
    );

    return "0x" + signResponse.Signature;
  }

  async signTransaction(tx: ethers.TransactionRequest): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider is required for signing transactions");
    }

    // Populate transaction fields
    const populated = await this.populateTransaction(tx);

    // Create transaction and get hash
    const unsignedTx = ethers.Transaction.from(populated);
    const txHash = unsignedTx.hash;

    const signResponse = await this.kmsService.sign(
      this.keyId,
      txHash.slice(2) // Remove 0x prefix
    );

    // Combine transaction with signature
    const sig = ethers.Signature.from("0x" + signResponse.Signature);
    unsignedTx.signature = sig;

    return unsignedTx.serialized;
  }

  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, any>
  ): Promise<string> {
    // Hash the typed data
    const hash = ethers.TypedDataEncoder.hash(domain, types, value);

    const signResponse = await this.kmsService.sign(
      this.keyId,
      hash.slice(2) // Remove 0x prefix
    );

    return "0x" + signResponse.Signature;
  }

  connect(provider: ethers.Provider): KmsSigner {
    return new KmsSigner(this.keyId, this.kmsService, provider);
  }
}
