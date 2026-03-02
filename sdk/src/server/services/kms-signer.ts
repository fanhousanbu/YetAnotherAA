import { ethers } from "ethers";
import axios from "axios";
import { ILogger, ConsoleLogger } from "../interfaces/logger";

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
}

export interface KmsSignHashResponse {
  Signature: string;
}

/**
 * KMS service for remote key management — extracted from NestJS KmsService.
 */
export class KmsManager {
  private readonly kmsEndpoint: string;
  private readonly isEnabled: boolean;
  private readonly logger: ILogger;

  constructor(options: { kmsEndpoint?: string; kmsEnabled?: boolean; logger?: ILogger }) {
    this.kmsEndpoint = options.kmsEndpoint ?? "https://kms.aastar.io";
    this.isEnabled = options.kmsEnabled === true;
    this.logger = options.logger ?? new ConsoleLogger("[KmsManager]");
  }

  isKmsEnabled(): boolean {
    return this.isEnabled;
  }

  async createKey(description: string): Promise<KmsCreateKeyResponse> {
    if (!this.isEnabled) {
      throw new Error("KMS service is not enabled");
    }

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

    return response.data as KmsCreateKeyResponse;
  }

  async signHash(address: string, hash: string): Promise<KmsSignHashResponse> {
    if (!this.isEnabled) {
      throw new Error("KMS service is not enabled");
    }

    const formattedHash = hash.startsWith("0x") ? hash : `0x${hash}`;

    const response = await axios.post(
      `${this.kmsEndpoint}/SignHash`,
      {
        Address: address,
        Hash: formattedHash,
      },
      {
        headers: {
          "Content-Type": "application/x-amz-json-1.1",
          "x-amz-target": "TrentService.SignHash",
        },
      }
    );

    return response.data as KmsSignHashResponse;
  }

  createKmsSigner(keyId: string, address: string, provider?: ethers.Provider): KmsSigner {
    if (!this.isEnabled) {
      throw new Error("KMS service is not enabled");
    }
    return new KmsSigner(keyId, address, this, provider);
  }
}

/**
 * ethers.AbstractSigner backed by KMS — extracted from NestJS KmsSigner.
 */
export class KmsSigner extends ethers.AbstractSigner {
  constructor(
    private readonly keyId: string,
    private readonly _address: string,
    private readonly kmsManager: KmsManager,
    provider?: ethers.Provider
  ) {
    super(provider);
  }

  async getAddress(): Promise<string> {
    return this._address;
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const messageBytes = typeof message === "string" ? ethers.toUtf8Bytes(message) : message;
    const messageHash = ethers.hashMessage(messageBytes);
    const signResponse = await this.kmsManager.signHash(this._address, messageHash);
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
    const signResponse = await this.kmsManager.signHash(this._address, txHash);
    const sig = ethers.Signature.from("0x" + signResponse.Signature);
    unsignedTx.signature = sig;
    return unsignedTx.serialized;
  }

  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, unknown>
  ): Promise<string> {
    const hash = ethers.TypedDataEncoder.hash(domain, types, value);
    const signResponse = await this.kmsManager.signHash(this._address, hash);
    return "0x" + signResponse.Signature;
  }

  connect(provider: ethers.Provider): KmsSigner {
    return new KmsSigner(this.keyId, this._address, this.kmsManager, provider);
  }
}
