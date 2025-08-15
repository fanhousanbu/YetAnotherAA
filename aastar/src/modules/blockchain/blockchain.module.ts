import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlsNodeDiscoveryService } from './gossip-discovery.service';
import { DiscoveryController } from './gossip.controller';

@Module({
  imports: [ConfigModule],
  controllers: [DiscoveryController],
  providers: [BlsNodeDiscoveryService],
  exports: [BlsNodeDiscoveryService],
})
export class BlockchainModule {}