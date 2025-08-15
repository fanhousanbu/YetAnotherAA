import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GossipDiscoveryService } from './gossip-discovery.service';
import { GossipController } from './gossip.controller';

@Module({
  imports: [ConfigModule],
  controllers: [GossipController],
  providers: [GossipDiscoveryService],
  exports: [GossipDiscoveryService],
})
export class BlockchainModule {}