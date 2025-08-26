import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService) {}

  getHealth() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  getInfo() {
    return {
      name: 'AAStar API',
      version: '1.0.0',
      description: 'ERC-4337 Account Abstraction API with BLS Aggregate Signatures',
      network: 'Sepolia',
      contracts: {
        entryPoint: this.configService.get('ENTRY_POINT_ADDRESS'),
        accountFactory: this.configService.get('AASTAR_ACCOUNT_FACTORY_ADDRESS'),
        validator: this.configService.get('VALIDATOR_CONTRACT_ADDRESS'),
      },
    };
  }
}