import { Module, forwardRef } from "@nestjs/common";
import { BlsService } from "./bls.service";
import { BlsController } from "./bls.controller";
import { AccountModule } from "../account/account.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    forwardRef(() => AccountModule),
    forwardRef(() => AuthModule)
  ],
  providers: [BlsService],
  controllers: [BlsController],
  exports: [BlsService],
})
export class BlsModule {}
