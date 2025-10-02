import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { KmsService } from "./kms.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [KmsService],
  exports: [KmsService],
})
export class KmsModule {}
