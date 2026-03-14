import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { AccountModule } from "./account/account.module";
import { TransferModule } from "./transfer/transfer.module";
import { BlsModule } from "./bls/bls.module";
import { EthereumModule } from "./ethereum/ethereum.module";
import { DatabaseModule } from "./database/database.module";
import { AppConfigModule } from "./config/config.module";
import { PaymasterModule } from "./paymaster/paymaster.module";
import { TokenModule } from "./token/token.module";
import { UserTokenModule } from "./user-token/user-token.module";
import { UserNFTModule } from "./user-nft/user-nft.module";
import { DataToolsModule } from "./data-tools/data-tools.module";
import { SdkModule } from "./sdk/sdk.module";
import { GuardianModule } from "./guardian/guardian.module";
import { RegistryModule } from "./registry/registry.module";

@Module({
  imports: [
    AppConfigModule, // This must be first to validate env vars on startup
    DatabaseModule.forRoot(),
    AuthModule,
    SdkModule, // After DatabaseModule and AuthModule (provides YAAA_SERVER_CLIENT globally)
    AccountModule,
    TransferModule,
    BlsModule,
    EthereumModule,
    PaymasterModule,
    TokenModule,
    UserTokenModule,
    UserNFTModule,
    DataToolsModule,
    GuardianModule,
    RegistryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
