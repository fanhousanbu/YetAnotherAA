import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TransferService } from './transfer.service';
import { TransferDto, TransferResultDto } from './dto/transfer.dto';
import { BaseResponseDto } from '../common/dto/base.dto';

@ApiTags('transfer')
@Controller('transfer')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post()
  @ApiOperation({ 
    summary: '执行转账', 
    description: '使用ERC-4337账户抽象执行转账操作，支持ECDSA和AAStarValidator两种验证模式'
  })
  @ApiResponse({ 
    status: 200, 
    description: '转账成功',
    type: BaseResponseDto<TransferResultDto>
  })
  @ApiResponse({ status: 400, description: '转账失败' })
  async transfer(@Body() transferDto: TransferDto) {
    try {
      const result = await this.transferService.transfer(
        transferDto.fromPrivateKey,
        transferDto.toAddress,
        transferDto.amount,
        transferDto.useAAStarValidator || false,
        transferDto.nodeIds,
        transferDto.salt || '12345'
      );

      return BaseResponseDto.success(result, '转账操作已提交');
    } catch (error) {
      throw new HttpException(
        BaseResponseDto.error(error.message, 'TRANSFER_FAILED'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('estimate')
  @ApiOperation({ 
    summary: '预估转账费用',
    description: '预估转账所需的Gas费用，但不执行实际转账'
  })
  @ApiResponse({ 
    status: 200, 
    description: '费用预估成功',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            estimatedGas: { type: 'string', description: '预估Gas用量' },
            maxFeePerGas: { type: 'string', description: '最大Gas价格(wei)' },
            maxPriorityFeePerGas: { type: 'string', description: '最大优先费(wei)' },
            estimatedCost: { type: 'string', description: '预估总费用(ETH)' }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: '预估失败' })
  async estimateTransfer(@Body() transferDto: TransferDto) {
    try {
      // 这里可以实现费用预估逻辑
      // 暂时返回固定的预估值
      const estimateData = {
        estimatedGas: '100000',
        maxFeePerGas: '20000000000', // 20 gwei
        maxPriorityFeePerGas: '2000000000', // 2 gwei
        estimatedCost: '0.002', // 0.002 ETH
        validatorType: transferDto.useAAStarValidator ? 'AAStarValidator' : 'ECDSA',
        note: transferDto.useAAStarValidator 
          ? 'AAStarValidator可能需要更多Gas用于BLS验证'
          : '标准ECDSA验证'
      };

      return BaseResponseDto.success(estimateData, '费用预估完成');
    } catch (error) {
      throw new HttpException(
        BaseResponseDto.error(error.message, 'ESTIMATE_FAILED'),
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}