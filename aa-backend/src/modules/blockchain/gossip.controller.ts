import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { GossipDiscoveryService } from './gossip-discovery.service';
import { BlsNode, GossipStats } from '../../interfaces/bls-node.interface';

@ApiTags('Gossip Network')
@Controller('gossip')
export class GossipController {
  constructor(private readonly gossipDiscoveryService: GossipDiscoveryService) {}

  @Get('nodes')
  @ApiOperation({ summary: 'Get all discovered BLS nodes' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of all discovered BLS nodes',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nodeId: { type: 'string' },
              publicKey: { type: 'string' },
              apiEndpoint: { type: 'string' },
              gossipEndpoint: { type: 'string' },
              status: { type: 'string', enum: ['active', 'inactive', 'suspected'] },
              lastSeen: { type: 'string', format: 'date-time' },
              region: { type: 'string' },
              capabilities: { type: 'array', items: { type: 'string' } },
              version: { type: 'string' },
              heartbeatCount: { type: 'number' }
            }
          }
        },
        count: { type: 'number' }
      }
    }
  })
  getAllNodes(): { success: boolean; nodes: BlsNode[]; count: number } {
    const nodes = this.gossipDiscoveryService.getAllKnownNodes();
    return {
      success: true,
      nodes,
      count: nodes.length,
    };
  }

  @Get('nodes/active')
  @ApiOperation({ summary: 'Get active BLS nodes available for signing' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of active BLS nodes',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nodeId: { type: 'string' },
              publicKey: { type: 'string' },
              apiEndpoint: { type: 'string' },
              gossipEndpoint: { type: 'string' },
              status: { type: 'string' },
              lastSeen: { type: 'string', format: 'date-time' },
              region: { type: 'string' },
              capabilities: { type: 'array', items: { type: 'string' } },
              version: { type: 'string' },
              heartbeatCount: { type: 'number' }
            }
          }
        },
        count: { type: 'number' }
      }
    }
  })
  async getActiveNodes(): Promise<{ success: boolean; nodes: BlsNode[]; count: number }> {
    try {
      const nodes = await this.gossipDiscoveryService.getAvailableNodes();
      return {
        success: true,
        nodes,
        count: nodes.length,
      };
    } catch (error) {
      return {
        success: false,
        nodes: [],
        count: 0,
      };
    }
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get gossip network statistics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Gossip network statistics',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        stats: {
          type: 'object',
          properties: {
            totalPeers: { type: 'number' },
            activePeers: { type: 'number' },
            suspectedPeers: { type: 'number' },
            messagesSent: { type: 'number' },
            messagesReceived: { type: 'number' },
            gossipRounds: { type: 'number' },
            lastGossipTime: { type: 'string', format: 'date-time', nullable: true }
          }
        }
      }
    }
  })
  getStats(): { success: boolean; stats: GossipStats } {
    const stats = this.gossipDiscoveryService.getStats();
    return {
      success: true,
      stats,
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get gossip network health status' })
  @ApiResponse({ 
    status: 200, 
    description: 'Health status of the gossip network',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        health: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'isolated'] },
            timestamp: { type: 'string', format: 'date-time' },
            peers: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                active: { type: 'number' },
                suspected: { type: 'number' }
              }
            },
            gossip: {
              type: 'object',
              properties: {
                rounds: { type: 'number' },
                messagesSent: { type: 'number' },
                messagesReceived: { type: 'number' },
                lastGossipTime: { type: 'string', format: 'date-time', nullable: true }
              }
            },
            connectivity: {
              type: 'object',
              properties: {
                hasActivePeers: { type: 'boolean' },
                isGossiping: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  })
  getHealth(): { success: boolean; health: any } {
    const stats = this.gossipDiscoveryService.getStats();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      peers: {
        total: stats.totalPeers,
        active: stats.activePeers,
        suspected: stats.suspectedPeers,
      },
      gossip: {
        rounds: stats.gossipRounds,
        messagesSent: stats.messagesSent,
        messagesReceived: stats.messagesReceived,
        lastGossipTime: stats.lastGossipTime,
      },
      connectivity: {
        hasActivePeers: stats.activePeers > 0,
        isGossiping: stats.lastGossipTime !== null,
      },
    };

    // 确定整体健康状态
    if (stats.activePeers === 0) {
      health.status = 'isolated';
    } else if (stats.suspectedPeers > stats.activePeers) {
      health.status = 'degraded';
    }

    return {
      success: true,
      health,
    };
  }

  @Get('signers/:count')
  @ApiOperation({ summary: 'Select optimal signers for BLS signature aggregation' })
  @ApiParam({ name: 'count', description: 'Number of signers to select', type: 'number', example: 3 })
  @ApiResponse({ 
    status: 200, 
    description: 'Selected signer nodes',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        signers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nodeId: { type: 'string' },
              publicKey: { type: 'string' },
              apiEndpoint: { type: 'string' },
              gossipEndpoint: { type: 'string' },
              status: { type: 'string' },
              lastSeen: { type: 'string', format: 'date-time' },
              region: { type: 'string' },
              capabilities: { type: 'array', items: { type: 'string' } },
              version: { type: 'string' },
              heartbeatCount: { type: 'number' }
            }
          }
        },
        count: { type: 'number' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Insufficient signers available' })
  async selectSigners(@Param('count', ParseIntPipe) count: number): Promise<{ success: boolean; signers?: BlsNode[]; count?: number; message: string }> {
    try {
      const signers = await this.gossipDiscoveryService.selectSigners(count);
      return {
        success: true,
        signers,
        count: signers.length,
        message: `Selected ${signers.length} signers for BLS aggregation`,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to select signers',
      };
    }
  }
}
