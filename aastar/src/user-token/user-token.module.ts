import { Module } from "@nestjs/common";
import { UserTokenService } from "./user-token.service";
import { UserTokenController } from "./user-token.controller";
import { TokenModule } from "../token/token.module";
import { AccountModule } from "../account/account.module";

@Module({
  imports: [TokenModule, AccountModule],
  providers: [UserTokenService],
  controllers: [UserTokenController],
  exports: [UserTokenService],
})
export class UserTokenModule {}
