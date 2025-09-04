import { Injectable } from "@nestjs/common";
import { ethers } from "ethers";
import { bls, sigs, BLS_DST, encodeG2Point } from "../../utils/bls.util.js";
import { SignatureResult } from "../../interfaces/signature.interface.js";
import { NodeKeyPair } from "../../interfaces/node.interface.js";

// On-chain validator contract for messagePoint generation
const VALIDATOR_ADDRESS =
  process.env.VALIDATOR_CONTRACT_ADDRESS || "0xFA4A1D9E471044607FE5F3854dE715b6e6bB01A4";
const VALIDATOR_ABI = [
  "function hashUserOpToG2(bytes32 userOpHash) external view returns (bytes memory)",
];
const RPC_URL = process.env.ETH_RPC_URL;

@Injectable()
export class BlsService {
  async signMessage(message: string, node: NodeKeyPair): Promise<SignatureResult> {
    const messageBytes = ethers.getBytes(message);
    const messagePoint = await bls.G2.hashToCurve(messageBytes, { DST: BLS_DST });

    const privateKeyBytes = this.hexToBytes(node.privateKey.substring(2));
    const publicKey = sigs.getPublicKey(privateKeyBytes);
    const signature = await sigs.sign(messagePoint as any, privateKeyBytes);

    // Return both compact and EIP-2537 formats
    return {
      nodeId: node.contractNodeId,
      signature: this.encodeToEIP2537(signature), // Use EIP-2537 format as default
      signatureCompact: signature.toHex(), // Keep compact format for backward compatibility
      publicKey: publicKey.toHex(),
      message: message,
    };
  }

  async aggregateSignatures(signatures: any[], publicKeys: any[]): Promise<any> {
    const aggregatedSignature = sigs.aggregateSignatures(signatures);
    const aggregatedPubKey = sigs.aggregatePublicKeys(publicKeys);
    return { aggregatedSignature, aggregatedPubKey };
  }

  async aggregateSignaturesOnly(signatures: any[]): Promise<any> {
    return sigs.aggregateSignatures(signatures);
  }

  async verifySignature(signature: any, messagePoint: any, publicKey: any): Promise<boolean> {
    return await sigs.verify(signature, messagePoint, publicKey);
  }

  async hashMessageToCurve(message: string): Promise<any> {
    const messageBytes = ethers.getBytes(message);
    return await bls.G2.hashToCurve(messageBytes, { DST: BLS_DST });
  }

  /**
   * Get messagePoint from on-chain validator contract using EIP-2537
   * This ensures exact consistency with chain validation
   */
  async hashToG2Simple(userOpHash: string): Promise<any> {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const validator = new ethers.Contract(VALIDATOR_ADDRESS, VALIDATOR_ABI, provider);

    const messagePointBytes = await validator.hashUserOpToG2(userOpHash);

    // Decode the 256-byte EIP-2537 G2 point format
    return this.decodeG2Point(messagePointBytes);
  }

  /**
   * Decode EIP-2537 format G2 point to bls library format
   * EIP-2537 format: [16 zero bytes][48 bytes x.c0][16 zero bytes][48 bytes x.c1][16 zero bytes][48 bytes y.c0][16 zero bytes][48 bytes y.c1]
   */
  private decodeG2Point(messagePointBytes: string): any {
    const bytes = ethers.getBytes(messagePointBytes);
    if (bytes.length !== 256) {
      throw new Error(`Invalid G2 point length: ${bytes.length}, expected 256`);
    }

    // Extract field elements from EIP-2537 format
    // Each field element is 64 bytes: 16 zero bytes + 48 data bytes
    const x0 = bytes.slice(16, 64); // x.c0: skip first 16 zeros, take next 48 bytes
    const x1 = bytes.slice(80, 128); // x.c1: skip next 16 zeros, take next 48 bytes
    const y0 = bytes.slice(144, 192); // y.c0: skip next 16 zeros, take next 48 bytes
    const y1 = bytes.slice(208, 256); // y.c1: skip next 16 zeros, take next 48 bytes

    // Convert to hex strings and then to BigInt
    const x0Hex = Buffer.from(x0).toString("hex");
    const x1Hex = Buffer.from(x1).toString("hex");
    const y0Hex = Buffer.from(y0).toString("hex");
    const y1Hex = Buffer.from(y1).toString("hex");

    // Create Fp2 elements for noble curves
    const x = { c0: BigInt("0x" + x0Hex), c1: BigInt("0x" + x1Hex) };
    const y = { c0: BigInt("0x" + y0Hex), c1: BigInt("0x" + y1Hex) };

    // Create the G2 point using noble curves Point.fromAffine method
    return bls.G2.Point.fromAffine({ x, y });
  }

  encodeToEIP2537(point: any): string {
    // Directly encode the point without conversion
    const encoded = encodeG2Point(point);
    return "0x" + Buffer.from(encoded).toString("hex");
  }

  encodePublicKeyToEIP2537(publicKey: any): string {
    const encoded = this.encodeG1Point(publicKey);
    return "0x" + Buffer.from(encoded).toString("hex");
  }

  private encodeG1Point(point: any): Uint8Array {
    const result = new Uint8Array(128);
    const affine = point.toAffine();

    const xBytes = this.hexToBytes(affine.x.toString(16).padStart(96, "0"));
    const yBytes = this.hexToBytes(affine.y.toString(16).padStart(96, "0"));

    result.set(xBytes, 16); // Skip 16 zero bytes at start
    result.set(yBytes, 80); // Skip 16 zero bytes at start
    return result;
  }

  async getPublicKeyFromPrivateKey(privateKey: string): Promise<string> {
    const privateKeyBytes = this.hexToBytes(privateKey.substring(2));
    const publicKey = sigs.getPublicKey(privateKeyBytes);
    return "0x" + publicKey.toHex();
  }

  private hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }
}
