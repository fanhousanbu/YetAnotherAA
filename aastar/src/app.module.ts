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

@Module({
  imports: [
    AppConfigModule, // This must be first to validate env vars on startup
    DatabaseModule.forRoot(),
    AuthModule,
    AccountModule,
    TransferModule,
    BlsModule,
    EthereumModule,
    PaymasterModule,
    TokenModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
