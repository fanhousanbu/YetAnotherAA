import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { BlsService } from './bls.service';
import { BlsController } from './bls.controller';

@Module({
  imports: [
    HttpModule.register({
      timeout: 10000, // 10秒超时
      maxRedirects: 5,
    }),
    ConfigModule,
  ],
  controllers: [BlsController],
  providers: [BlsService],
  exports: [BlsService],
})
export class BlsModule {}