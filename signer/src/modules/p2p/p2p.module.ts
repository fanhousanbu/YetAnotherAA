import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { P2PService } from './p2p.service.js';
import { P2PController } from './p2p.controller.js';
import { NodeModule } from '../node/node.module.js';

@Module({
  imports: [ConfigModule, NodeModule],
  providers: [P2PService],
  controllers: [P2PController],
  exports: [P2PService],
})
export class P2PModule {}