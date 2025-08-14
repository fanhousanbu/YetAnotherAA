import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { P2PDiscoveryService } from './p2p-discovery.service';

@Module({
  imports: [ConfigModule],
  providers: [P2PDiscoveryService],
  exports: [P2PDiscoveryService],
})
export class BlockchainModule {}