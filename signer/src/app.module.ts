import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BlsModule } from './modules/bls/bls.module.js';
import { NodeModule } from './modules/node/node.module.js';
import { SignatureModule } from './modules/signature/signature.module.js';
import { BlockchainModule } from './modules/blockchain/blockchain.module.js';
import { GossipModule } from './modules/gossip/gossip.module.js';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    BlsModule,
    NodeModule,
    SignatureModule,
    BlockchainModule,
    GossipModule,
  ],
})
export class AppModule {}