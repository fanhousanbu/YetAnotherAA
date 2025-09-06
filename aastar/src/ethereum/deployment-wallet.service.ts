import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ethers } from "ethers";

@Injectable()
export class DeploymentWalletService {
  private deploymentWallet: ethers.Wallet;

  constructor(private configService: ConfigService) {
    const privateKey = this.configService.get<string>("ETH_PRIVATE_KEY");
    if (!privateKey) {
      throw new Error("ETH_PRIVATE_KEY not found in configuration");
    }
    this.deploymentWallet = new ethers.Wallet(privateKey);
  }

  getWallet(provider?: ethers.Provider): ethers.Wallet {
    if (provider) {
      return this.deploymentWallet.connect(provider);
    }
    return this.deploymentWallet;
  }

  getAddress(): string {
    return this.deploymentWallet.address;
  }
}
