import { Module, forwardRef } from '@nestjs/common';
import { BlsService } from './bls.service';
import { BlsController } from './bls.controller';
import { AccountModule } from '../account/account.module';

@Module({
  imports: [forwardRef(() => AccountModule)],
  providers: [BlsService],
  controllers: [BlsController],
  exports: [BlsService],
})
export class BlsModule {}