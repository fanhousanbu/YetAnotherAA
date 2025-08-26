import { Module } from "@nestjs/common";
import { AccountController } from "./account.controller";
import { AccountService } from "./account.service";
import { EthereumService } from "../ethereum/ethereum.service";

@Module({
  controllers: [AccountController],
  providers: [AccountService, EthereumService],
  exports: [AccountService],
})
export class AccountModule {}
