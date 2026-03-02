import { Module } from "@nestjs/common";
import { BlsService } from "./bls.service";
import { BlsController } from "./bls.controller";

@Module({
  providers: [BlsService],
  controllers: [BlsController],
  exports: [BlsService],
})
export class BlsModule {}
