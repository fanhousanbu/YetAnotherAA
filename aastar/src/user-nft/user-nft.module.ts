import { Module } from "@nestjs/common";
import { UserNFTService } from "./user-nft.service";
import { UserNFTController } from "./user-nft.controller";
import { AccountModule } from "../account/account.module";

@Module({
  imports: [AccountModule],
  providers: [UserNFTService],
  controllers: [UserNFTController],
  exports: [UserNFTService],
})
export class UserNFTModule {}
