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
    Address?: string; // Address from KMS
  };
  Mnemonic: string;
  Address?: string; // Alternative location for address
}

export interface KmsSignHashResponse {
  Signature: string;
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
      const requestPayload = {
        Description: description,
        KeyUsage: "SIGN_VERIFY",
        KeySpec: "ECC_SECG_P256K1",
        Origin: "AWS_KMS",
      };

      const requestHeaders = {
        "Content-Type": "application/json",
        "x-amz-target": "TrentService.CreateKey",
      };

      // Log the request details
      this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      this.logger.log("🔑 KMS CreateKey Request");
      this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      this.logger.log(`📍 Endpoint: ${this.kmsEndpoint}/CreateKey`);
      this.logger.log(`📋 Headers: ${JSON.stringify(requestHeaders, null, 2)}`);
      this.logger.log(`📦 Payload: ${JSON.stringify(requestPayload, null, 2)}`);
      this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      const startTime = Date.now();
      const response = await axios.post(`${this.kmsEndpoint}/CreateKey`, requestPayload, {
        headers: requestHeaders,
      });
      const duration = Date.now() - startTime;

      const kmsResponse = response.data as KmsCreateKeyResponse;

      // Log the response details
      this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      this.logger.log("✅ KMS CreateKey Response");
      this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      this.logger.log(`⏱️  Duration: ${duration}ms`);
      this.logger.log(`🔑 KeyId: ${kmsResponse.KeyMetadata.KeyId}`);
      this.logger.log(
        `📍 Address: ${kmsResponse.KeyMetadata.Address || kmsResponse.Address || "N/A"}`
      );
      this.logger.log(`📝 Description: ${kmsResponse.KeyMetadata.Description}`);
      this.logger.log(`🔐 KeySpec: ${kmsResponse.KeyMetadata.KeySpec}`);
      this.logger.log(`📄 Full Response: ${JSON.stringify(kmsResponse, null, 2)}`);
      this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      return kmsResponse;
    } catch (error) {
      this.logger.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      this.logger.error("❌ KMS CreateKey Failed");
      this.logger.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      this.logger.error(`Error: ${error.message}`);
      if (error.response) {
        this.logger.error(`Status: ${error.response.status}`);
        this.logger.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      this.logger.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      throw new Error(`KMS key creation failed: ${error.message}`);
    }
  }

  /**
   * Sign a hash using KMS with address
   */
  async signHash(address: string, hash: string): Promise<KmsSignHashResponse> {
    if (!this.isEnabled) {
      throw new Error("KMS service is not enabled");
    }

    try {
      // Ensure hash has 0x prefix
      const formattedHash = hash.startsWith("0x") ? hash : `0x${hash}`;

      const requestPayload = {
        Address: address,
        Hash: formattedHash,
      };

      const requestHeaders = {
        "Content-Type": "application/x-amz-json-1.1",
        "x-amz-target": "TrentService.SignHash",
      };

      // Log the request details
      this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      this.logger.log("🖊️  KMS SignHash Request");
      this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      this.logger.log(`📍 Endpoint: ${this.kmsEndpoint}/SignHash`);
      this.logger.log(`📋 Headers: ${JSON.stringify(requestHeaders, null, 2)}`);
      this.logger.log(`📦 Payload:`);
      this.logger.log(`   Address: ${address}`);
      this.logger.log(`   Hash: ${formattedHash}`);
      this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      const startTime = Date.now();
      const response = await axios.post(`${this.kmsEndpoint}/SignHash`, requestPayload, {
        headers: requestHeaders,
      });
      const duration = Date.now() - startTime;

      const signResponse = response.data as KmsSignHashResponse;

      // Log the response details
      this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      this.logger.log("✅ KMS SignHash Response");
      this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      this.logger.log(`⏱️  Duration: ${duration}ms`);
      this.logger.log(`🖊️  Signature: 0x${signResponse.Signature}`);
      this.logger.log(`📄 Full Response: ${JSON.stringify(signResponse, null, 2)}`);

      // Verify signature recovery if possible
      try {
        const sig = ethers.Signature.from("0x" + signResponse.Signature);
        const recoveredAddress = ethers.recoverAddress(formattedHash, sig);
        this.logger.log(`✔️  Recovered Address: ${recoveredAddress}`);
        this.logger.log(
          `✔️  Address Match: ${recoveredAddress.toLowerCase() === address.toLowerCase() ? "✅ YES" : "❌ NO"}`
        );
      } catch (e) {
        // Signature recovery is optional, just for debugging
      }

      this.logger.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

      return signResponse;
    } catch (error) {
      this.logger.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      this.logger.error("❌ KMS SignHash Failed");
      this.logger.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      this.logger.error(`Error: ${error.message}`);
      if (error.response) {
        this.logger.error(`Status: ${error.response.status}`);
        this.logger.error(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
      }
      this.logger.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      throw new Error(`KMS signing failed: ${error.message}`);
    }
  }

  /**
   * Verify the Ethereum address for a KMS key
   * Since KMS now returns Address in CreateKey response, this method is only for verification
   * @deprecated Use the address directly from CreateKey response instead
   */
  async verifyAddressForKey(keyId: string, address: string): Promise<string> {
    if (!this.isEnabled) {
      throw new Error("KMS service is not enabled");
    }

    if (!address) {
      throw new Error(
        "Address is required. KMS addresses should be obtained from CreateKey response. " +
          "The old getAddressForKey method without address parameter is no longer supported."
      );
    }

    try {
      // Verify the address by signing a test message
      const testMessage = "Verify Address";
      const messageBytes = ethers.toUtf8Bytes(testMessage);
      const messageHash = ethers.hashMessage(messageBytes);

      const signResponse = await this.signHash(address, messageHash);

      // Recover address from signature
      const signature = "0x" + signResponse.Signature;
      const sig = ethers.Signature.from(signature);
      const recoveredAddress = ethers.recoverAddress(messageHash, sig);

      if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
        this.logger.warn(
          `Address verification warning for KMS key ${keyId}: expected ${address}, got ${recoveredAddress}`
        );
      }

      return address;
    } catch (error) {
      this.logger.error(`Failed to verify KMS key address: ${error.message}`);
      throw error;
    }
  }

  // Keep the old method signature for backward compatibility but make it clear it needs an address
  async getAddressForKey(keyId: string, knownAddress?: string): Promise<string> {
    if (!knownAddress) {
      throw new Error(
        "Address parameter is required. KMS addresses must be obtained from CreateKey response. " +
          "Use the Address field from KMS CreateKey response instead of calling this method."
      );
    }
    return this.verifyAddressForKey(keyId, knownAddress);
  }

  /**
   * Create a signer that uses KMS for signing operations
   */
  createKmsSigner(keyId: string, address: string, provider?: ethers.Provider): KmsSigner {
    if (!this.isEnabled) {
      throw new Error("KMS service is not enabled");
    }

    return new KmsSigner(keyId, address, this, provider);
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
  constructor(
    private readonly keyId: string,
    private readonly address: string,
    private readonly kmsService: KmsService,
    provider?: ethers.Provider
  ) {
    super(provider);
  }

  async getAddress(): Promise<string> {
    return this.address;
  }

  async signMessage(message: string | Uint8Array): Promise<string> {
    const messageBytes = typeof message === "string" ? ethers.toUtf8Bytes(message) : message;
    const messageHash = ethers.hashMessage(messageBytes);

    console.log("════════════════════════════════════════════");
    console.log("📝 KmsSigner.signMessage Called");
    console.log("════════════════════════════════════════════");
    console.log(`💰 Address: ${this.address}`);
    console.log(`📃 Message: ${typeof message === "string" ? message : "[Uint8Array]"}`);
    console.log(`#️⃣  Hash: ${messageHash}`);
    console.log("════════════════════════════════════════════");

    const signResponse = await this.kmsService.signHash(this.address, messageHash);
    const signature = "0x" + signResponse.Signature;

    console.log("✅ Message signed successfully");
    console.log(`🖊️  Signature: ${signature}`);
    console.log("════════════════════════════════════════════");

    return signature;
  }

  async signTransaction(tx: ethers.TransactionRequest): Promise<string> {
    if (!this.provider) {
      throw new Error("Provider is required for signing transactions");
    }

    console.log("════════════════════════════════════════════");
    console.log("💸 KmsSigner.signTransaction Called");
    console.log("════════════════════════════════════════════");
    console.log(`💰 From: ${this.address}`);
    console.log(`📍 To: ${tx.to || "Contract Creation"}`);
    console.log(`💵 Value: ${tx.value || "0"}`);
    console.log("════════════════════════════════════════════");

    // Populate transaction fields
    const populated = await this.populateTransaction(tx);

    // Create transaction and get hash
    const unsignedTx = ethers.Transaction.from(populated);
    const txHash = unsignedTx.hash;

    console.log(`#️⃣  Transaction Hash: ${txHash}`);

    const signResponse = await this.kmsService.signHash(this.address, txHash);

    // Combine transaction with signature
    const sig = ethers.Signature.from("0x" + signResponse.Signature);
    unsignedTx.signature = sig;

    console.log("✅ Transaction signed successfully");
    console.log(`📦 Serialized TX: ${unsignedTx.serialized.substring(0, 50)}...`);
    console.log("════════════════════════════════════════════");

    return unsignedTx.serialized;
  }

  async signTypedData(
    domain: ethers.TypedDataDomain,
    types: Record<string, ethers.TypedDataField[]>,
    value: Record<string, any>
  ): Promise<string> {
    // Hash the typed data
    const hash = ethers.TypedDataEncoder.hash(domain, types, value);

    const signResponse = await this.kmsService.signHash(this.address, hash);
    return "0x" + signResponse.Signature;
  }

  connect(provider: ethers.Provider): KmsSigner {
    return new KmsSigner(this.keyId, this.address, this.kmsService, provider);
  }
}
