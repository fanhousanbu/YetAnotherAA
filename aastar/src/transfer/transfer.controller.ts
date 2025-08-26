import { Controller, Post, Get, Body, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TransferService } from './transfer.service';
import { ExecuteTransferDto } from './dto/execute-transfer.dto';
import { EstimateGasDto } from './dto/estimate-gas.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('transfer')
@Controller('transfer')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransferController {
  constructor(private transferService: TransferService) {}

  @Post('execute')
  @ApiOperation({ summary: 'Execute ERC-4337 transfer' })
  async executeTransfer(@Request() req, @Body() executeTransferDto: ExecuteTransferDto) {
    return this.transferService.executeTransfer(req.user.sub, executeTransferDto);
  }

  @Post('estimate')
  @ApiOperation({ summary: 'Estimate gas for transfer' })
  async estimateGas(@Request() req, @Body() estimateGasDto: EstimateGasDto) {
    return this.transferService.estimateGas(req.user.sub, estimateGasDto);
  }

  @Get('status/:id')
  @ApiOperation({ summary: 'Get transfer status by ID' })
  async getTransferStatus(@Request() req, @Param('id') id: string) {
    return this.transferService.getTransferStatus(req.user.sub, id);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get transfer history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTransferHistory(
    @Request() req,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    return this.transferService.getTransferHistory(
      req.user.sub,
      parseInt(page),
      parseInt(limit),
    );
  }
}