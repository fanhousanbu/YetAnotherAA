import { Module } from '@nestjs/common';
import { TransferController } from './transfer.controller';
import { TransferService } from './transfer.service';
import { AccountModule } from '../account/account.module';
import { EthereumService } from '../ethereum/ethereum.service';
import { BlsModule } from '../bls/bls.module';

@Module({
  imports: [AccountModule, BlsModule],
  controllers: [TransferController],
  providers: [TransferService, EthereumService],
})
export class TransferModule {}