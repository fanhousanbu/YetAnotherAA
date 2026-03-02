import { Module } from "@nestjs/common";
import { GuardianService } from "./guardian.service";
import { GuardianController } from "./guardian.controller";

@Module({
  providers: [GuardianService],
  controllers: [GuardianController],
  exports: [GuardianService],
})
export class GuardianModule {}
