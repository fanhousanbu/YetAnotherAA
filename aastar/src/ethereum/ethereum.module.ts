import { Module, Global } from "@nestjs/common";
import { EthereumService } from "./ethereum.service";
import { DeploymentWalletService } from "./deployment-wallet.service";

@Global()
@Module({
  providers: [EthereumService, DeploymentWalletService],
  exports: [EthereumService, DeploymentWalletService],
})
export class EthereumModule {}
