import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class FundAccountDto {
  @ApiProperty({ description: 'Amount of ETH to fund', example: '0.1' })
  @IsString()
  amount: string;
}