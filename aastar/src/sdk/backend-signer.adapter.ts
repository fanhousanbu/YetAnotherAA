import { Injectable } from "@nestjs/common";
import { ISignerAdapter } from "@yaaa/sdk/server";
import { AuthService } from "../auth/auth.service";
import { ethers } from "ethers";

@Injectable()
export class BackendSignerAdapter implements ISignerAdapter {
  constructor(private authService: AuthService) {}

  async getAddress(userId: string): Promise<string> {
    const wallet = await this.authService.getUserWallet(userId);
    return wallet.address;
  }

  async getSigner(userId: string): Promise<ethers.Signer> {
    return this.authService.getUserWallet(userId);
  }

  async ensureSigner(userId: string): Promise<{ signer: ethers.Signer; address: string }> {
    const wallet = await this.authService.ensureUserWallet(userId);
    const address = wallet.address || (await wallet.getAddress());
    return { signer: wallet, address };
  }
}
