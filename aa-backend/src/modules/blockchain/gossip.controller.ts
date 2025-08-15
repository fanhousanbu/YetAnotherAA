import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { BlsNodeDiscoveryService } from './gossip-discovery.service';
import { BlsNode } from '../../interfaces/bls-node.interface';

@ApiTags('BLS Node Discovery')
@Controller('discovery')
export class DiscoveryController {
  constructor(private readonly discoveryService: BlsNodeDiscoveryService) {}

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
    const nodes = this.discoveryService.getAllKnownNodes();
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
      const nodes = await this.discoveryService.getAvailableNodes();
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
  @ApiOperation({ summary: 'Get discovery statistics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Discovery statistics',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        stats: {
          type: 'object',
          properties: {
            totalNodes: { type: 'number' },
            activeNodes: { type: 'number' },
            suspectedNodes: { type: 'number' },
            discoveryRounds: { type: 'number' },
            lastDiscoveryTime: { type: 'string', format: 'date-time', nullable: true }
          }
        }
      }
    }
  })
  getStats(): { success: boolean; stats: any } {
    const stats = this.discoveryService.getStats();
    return {
      success: true,
      stats,
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Get discovery service health status' })
  @ApiResponse({ 
    status: 200, 
    description: 'Health status of the discovery service',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        health: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'degraded', 'isolated'] },
            timestamp: { type: 'string', format: 'date-time' },
            nodes: {
              type: 'object',
              properties: {
                total: { type: 'number' },
                active: { type: 'number' },
                suspected: { type: 'number' }
              }
            },
            discovery: {
              type: 'object',
              properties: {
                rounds: { type: 'number' },
                lastDiscoveryTime: { type: 'string', format: 'date-time', nullable: true }
              }
            },
            connectivity: {
              type: 'object',
              properties: {
                hasActiveNodes: { type: 'boolean' },
                isDiscovering: { type: 'boolean' }
              }
            }
          }
        }
      }
    }
  })
  getHealth(): { success: boolean; health: any } {
    const stats = this.discoveryService.getStats();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      nodes: {
        total: stats.totalNodes,
        active: stats.activeNodes,
        suspected: stats.suspectedNodes,
      },
      discovery: {
        rounds: stats.discoveryRounds,
        lastDiscoveryTime: stats.lastDiscoveryTime,
      },
      connectivity: {
        hasActiveNodes: stats.activeNodes > 0,
        isDiscovering: stats.lastDiscoveryTime !== null,
      },
    };

    // 确定整体健康状态
    if (stats.activeNodes === 0) {
      health.status = 'isolated';
    } else if (stats.suspectedNodes > stats.activeNodes) {
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
      const signers = await this.discoveryService.selectSigners(count);
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
