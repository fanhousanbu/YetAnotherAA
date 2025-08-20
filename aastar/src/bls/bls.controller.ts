import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BlsService, BlsNode } from './bls.service';

@ApiTags('BLS签名服务')
@Controller('bls')
export class BlsController {
  constructor(private readonly blsService: BlsService) {}

  @Get('health')
  @ApiOperation({ 
    summary: '检查BLS服务健康状态',
    description: '检查种子节点是否可用'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'BLS服务健康状态',
    schema: {
      type: 'object',
      properties: {
        healthy: { type: 'boolean' },
        seedNode: { type: 'string' },
        timestamp: { type: 'string' }
      }
    }
  })
  async healthCheck() {
    const healthy = await this.blsService.healthCheck();
    return {
      healthy,
      seedNode: `${process.env.BLS_SEED_NODE_HOST || 'localhost'}:${process.env.BLS_SEED_NODE_PORT || 3001}`,
      timestamp: new Date().toISOString()
    };
  }

  @Get('nodes')
  @ApiOperation({
    summary: '获取活跃的BLS节点列表',
    description: '从种子节点获取当前可用的BLS签名节点'
  })
  @ApiResponse({
    status: 200,
    description: '活跃节点列表',
    schema: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nodeId: { type: 'string' },
              publicKey: { type: 'string' },
              address: { type: 'string' },
              port: { type: 'number' },
              status: { type: 'string', enum: ['active', 'inactive'] }
            }
          }
        },
        total: { type: 'number' }
      }
    }
  })
  async getActiveNodes() {
    const nodes = await this.blsService.getActiveNodes();
    return {
      nodes,
      total: nodes.length
    };
  }

  @Post('sign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'BLS签名测试',
    description: '对指定消息进行BLS聚合签名，用于测试'
  })
  @ApiResponse({
    status: 200,
    description: '签名成功',
    schema: {
      type: 'object',
      properties: {
        aggregatedSignature: { type: 'string' },
        aggregatedPublicKey: { type: 'string' },
        participatingNodes: {
          type: 'array',
          items: { type: 'string' }
        },
        message: { type: 'string' }
      }
    }
  })
  async signMessage(@Body() body: { message: string; nodeIds?: string[] }) {
    return await this.blsService.signMessage(body.message, body.nodeIds);
  }
}