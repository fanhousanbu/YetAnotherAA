import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { P2PService, PeerInfo } from './p2p.service.js';

@ApiTags('p2p')
@Controller('p2p')
export class P2PController {
  constructor(private readonly p2pService: P2PService) {}

  @Get('peers')
  @ApiOperation({ summary: 'Get known peers' })
  @ApiResponse({ status: 200, description: 'List of active peers' })
  getPeers(): { success: boolean; peers: PeerInfo[] } {
    return {
      success: true,
      peers: this.p2pService.getPeers(),
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get P2P network statistics' })
  @ApiResponse({ status: 200, description: 'P2P network statistics' })
  getStats() {
    return {
      success: true,
      stats: this.p2pService.getStats(),
    };
  }
}