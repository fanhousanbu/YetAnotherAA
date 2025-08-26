import { Module, Global } from '@nestjs/common';
import { EthereumService } from './ethereum.service';

@Global()
@Module({
  providers: [EthereumService],
  exports: [EthereumService],
})
export class EthereumModule {}