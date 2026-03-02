import { Module } from "@nestjs/common";
import { TokenService } from "./token.service";
import { TokenController } from "./token.controller";

@Module({
  providers: [TokenService],
  controllers: [TokenController],
  exports: [TokenService],
})
export class TokenModule {}
