import { Module, forwardRef } from "@nestjs/common";
import { TransferService } from "./transfer.service";
import { TransferController } from "./transfer.controller";
import { BlsModule } from "../bls/bls.module";
import { AccountModule } from "../account/account.module";
import { AuthModule } from "../auth/auth.module";
import { PaymasterModule } from "../paymaster/paymaster.module";
import { TokenModule } from "../token/token.module";

@Module({
  imports: [BlsModule, AccountModule, forwardRef(() => AuthModule), PaymasterModule, TokenModule],
  providers: [TransferService],
  controllers: [TransferController],
})
export class TransferModule {}
