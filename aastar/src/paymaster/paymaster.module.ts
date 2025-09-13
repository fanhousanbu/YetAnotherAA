import { Module } from "@nestjs/common";
import { PaymasterService } from "./paymaster.service";
import { PaymasterController } from "./paymaster.controller";

@Module({
  providers: [PaymasterService],
  controllers: [PaymasterController],
  exports: [PaymasterService],
})
export class PaymasterModule {}
