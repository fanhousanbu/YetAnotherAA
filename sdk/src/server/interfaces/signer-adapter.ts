import { ethers } from 'ethers';

/**
 * Pluggable signer adapter — replaces NestJS AuthService wallet management.
 * Implement this to provide signing capabilities from your key management system.
 */
export interface ISignerAdapter {
  /** Get the EOA address for a given user. */
  getAddress(userId: string): Promise<string>;

  /** Get an ethers Signer instance for a given user. */
  getSigner(userId: string): Promise<ethers.Signer>;

  /**
   * Ensure a signer exists for the user (create on demand if needed).
   * Returns the signer and its address.
   */
  ensureSigner(userId: string): Promise<{ signer: ethers.Signer; address: string }>;
}
