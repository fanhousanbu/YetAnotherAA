import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AccountModule } from './account/account.module';
import { TransferModule } from './transfer/transfer.module';
import { BlsModule } from './bls/bls.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    AccountModule,
    TransferModule,
    BlsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}