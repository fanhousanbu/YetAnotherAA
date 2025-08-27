import { Module } from "@nestjs/common";
import { TransferService } from "./transfer.service";
import { TransferController } from "./transfer.controller";
import { BlsModule } from "../bls/bls.module";
import { AccountModule } from "../account/account.module";

@Module({
  imports: [BlsModule, AccountModule],
  providers: [TransferService],
  controllers: [TransferController],
})
export class TransferModule {}
