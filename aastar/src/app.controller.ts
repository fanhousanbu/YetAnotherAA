import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: '健康检查' })
  @ApiResponse({ status: 200, description: '服务正常运行' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  @ApiOperation({ summary: '服务状态检查' })
  @ApiResponse({ 
    status: 200, 
    description: '返回服务健康状态',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', example: '2024-01-01T00:00:00.000Z' },
        service: { type: 'string', example: 'AAstar ERC-4337 API' },
        version: { type: 'string', example: '1.0.0' }
      }
    }
  })
  getHealth() {
    return this.appService.getHealth();
  }
}