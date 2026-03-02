import axios from "axios";
import { ethers } from "ethers";
import { KmsManager, KmsSigner } from "../services/kms-signer";
import { SilentLogger } from "../interfaces/logger";

jest.mock("axios");
const mockAxios = axios as jest.Mocked<typeof axios>;

const ENDPOINT = "https://kms.test.example";
const ADDRESS = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

// A valid compact ECDSA signature (r + s components, 64 bytes each, v byte)
// Arbitrary valid bytes — not cryptographically meaningful, just format-correct
const FAKE_SIG_HEX =
  "1b" +
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" +
  "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

// ── KmsManager ────────────────────────────────────────────────────────

describe("KmsManager", () => {
  afterEach(() => jest.clearAllMocks());

  describe("isKmsEnabled", () => {
    it("returns false when kmsEnabled is not set", () => {
      expect(new KmsManager({}).isKmsEnabled()).toBe(false);
    });

    it("returns false when kmsEnabled is false", () => {
      expect(new KmsManager({ kmsEnabled: false }).isKmsEnabled()).toBe(false);
    });

    it("returns true when kmsEnabled is true", () => {
      expect(new KmsManager({ kmsEnabled: true }).isKmsEnabled()).toBe(true);
    });
  });

  describe("createKey", () => {
    it("throws when KMS is not enabled", async () => {
      const m = new KmsManager({ kmsEndpoint: ENDPOINT, kmsEnabled: false });
      await expect(m.createKey("desc")).rejects.toThrow("KMS service is not enabled");
    });

    it("POSTs to /CreateKey and returns response data", async () => {
      const responseData = {
        KeyMetadata: {
          KeyId: "key-abc",
          Arn: "arn:aws:kms:us-east-1:123:key/key-abc",
          CreationDate: "2024-01-01",
          Enabled: true,
          Description: "test",
          KeyUsage: "SIGN_VERIFY",
          KeySpec: "ECC_SECG_P256K1",
          Origin: "AWS_KMS",
          Address: ADDRESS,
        },
        Mnemonic: "word1 word2 word3",
        Address: ADDRESS,
      };
      mockAxios.post.mockResolvedValueOnce({ data: responseData });

      const m = new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        logger: new SilentLogger(),
      });
      const result = await m.createKey("my-key");

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${ENDPOINT}/CreateKey`,
        expect.objectContaining({
          Description: "my-key",
          KeyUsage: "SIGN_VERIFY",
          KeySpec: "ECC_SECG_P256K1",
        }),
        expect.objectContaining({ headers: expect.any(Object) })
      );
      expect(result.KeyMetadata.KeyId).toBe("key-abc");
      expect(result.Address).toBe(ADDRESS);
    });
  });

  describe("signHash", () => {
    it("throws when KMS is not enabled", async () => {
      const m = new KmsManager({ kmsEndpoint: ENDPOINT });
      await expect(m.signHash(ADDRESS, "0xhash")).rejects.toThrow("KMS service is not enabled");
    });

    it("adds 0x prefix to hash that lacks it", async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { Signature: "aabbcc" } });

      const m = new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        logger: new SilentLogger(),
      });
      await m.signHash(ADDRESS, "noprefixhash");

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${ENDPOINT}/SignHash`,
        expect.objectContaining({ Hash: "0xnoprefixhash", Address: ADDRESS }),
        expect.any(Object)
      );
    });

    it("preserves existing 0x prefix on hash", async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { Signature: "ddeeff" } });

      const m = new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        logger: new SilentLogger(),
      });
      await m.signHash(ADDRESS, "0xalreadyprefixed");

      expect(mockAxios.post).toHaveBeenCalledWith(
        `${ENDPOINT}/SignHash`,
        expect.objectContaining({ Hash: "0xalreadyprefixed" }),
        expect.any(Object)
      );
    });

    it("returns the KMS response data", async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { Signature: FAKE_SIG_HEX } });

      const m = new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        logger: new SilentLogger(),
      });
      const result = await m.signHash(ADDRESS, "0xhash");
      expect(result.Signature).toBe(FAKE_SIG_HEX);
    });
  });

  describe("createKmsSigner", () => {
    it("throws when KMS is not enabled", () => {
      const m = new KmsManager({ kmsEndpoint: ENDPOINT });
      expect(() => m.createKmsSigner("key-1", ADDRESS)).toThrow("KMS service is not enabled");
    });

    it("returns a KmsSigner instance", () => {
      const m = new KmsManager({
        kmsEndpoint: ENDPOINT,
        kmsEnabled: true,
        logger: new SilentLogger(),
      });
      expect(m.createKmsSigner("key-1", ADDRESS)).toBeInstanceOf(KmsSigner);
    });
  });
});

// ── KmsSigner ─────────────────────────────────────────────────────────

describe("KmsSigner", () => {
  let manager: KmsManager;
  let signer: KmsSigner;

  beforeEach(() => {
    mockAxios.post.mockReset();
    manager = new KmsManager({
      kmsEndpoint: ENDPOINT,
      kmsEnabled: true,
      logger: new SilentLogger(),
    });
    signer = manager.createKmsSigner("key-1", ADDRESS);
  });

  it("getAddress returns the KMS-managed address", async () => {
    expect(await signer.getAddress()).toBe(ADDRESS);
  });

  it("signMessage calls signHash with EIP-191 message hash", async () => {
    mockAxios.post.mockResolvedValueOnce({ data: { Signature: FAKE_SIG_HEX } });

    const result = await signer.signMessage("hello");
    expect(result).toBe("0x" + FAKE_SIG_HEX);

    // Should have called signHash with the EIP-191 prefixed hash
    expect(mockAxios.post).toHaveBeenCalledWith(
      `${ENDPOINT}/SignHash`,
      expect.objectContaining({
        Address: ADDRESS,
        Hash: expect.stringMatching(/^0x[0-9a-f]{64}$/i),
      }),
      expect.any(Object)
    );
  });

  it("signMessage handles Uint8Array input", async () => {
    mockAxios.post.mockResolvedValueOnce({ data: { Signature: FAKE_SIG_HEX } });
    const bytes = new TextEncoder().encode("hello");
    const result = await signer.signMessage(bytes);
    expect(result).toBe("0x" + FAKE_SIG_HEX);
  });

  it("signTypedData calls signHash with typed data hash", async () => {
    mockAxios.post.mockResolvedValueOnce({ data: { Signature: FAKE_SIG_HEX } });

    const domain = { name: "TestApp", version: "1", chainId: 1 };
    const types = { Message: [{ name: "content", type: "string" }] };
    const value = { content: "hello" };

    const result = await signer.signTypedData(domain, types, value);
    expect(result).toBe("0x" + FAKE_SIG_HEX);
    expect(mockAxios.post).toHaveBeenCalledWith(
      `${ENDPOINT}/SignHash`,
      expect.objectContaining({ Address: ADDRESS }),
      expect.any(Object)
    );
  });

  it("signTransaction throws without provider", async () => {
    await expect(signer.signTransaction({ to: ADDRESS, value: 0n })).rejects.toThrow(
      "Provider is required"
    );
  });

  it("connect returns a new KmsSigner with the given provider", () => {
    const provider = new ethers.JsonRpcProvider("http://localhost:8545");
    const connected = signer.connect(provider);

    expect(connected).toBeInstanceOf(KmsSigner);
    expect(connected).not.toBe(signer);
    // Verify the new signer has the provider (can call provider-requiring methods)
    expect(connected.provider).toBe(provider);
  });
});
