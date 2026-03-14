import { Module } from "@nestjs/common";
import { OperatorService } from "./operator.service";
import { OperatorController } from "./operator.controller";

@Module({
  providers: [OperatorService],
  controllers: [OperatorController],
  exports: [OperatorService],
})
export class OperatorModule {}
