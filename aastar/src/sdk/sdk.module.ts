import { Module, Global } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BackendStorageAdapter } from "./backend-storage.adapter";
import { BackendSignerAdapter } from "./backend-signer.adapter";
import { yaaaServerClientProvider, YAAA_SERVER_CLIENT } from "./sdk.providers";

@Global()
@Module({
  imports: [AuthModule],
  providers: [BackendStorageAdapter, BackendSignerAdapter, yaaaServerClientProvider],
  exports: [YAAA_SERVER_CLIENT, BackendStorageAdapter, BackendSignerAdapter],
})
export class SdkModule {}
