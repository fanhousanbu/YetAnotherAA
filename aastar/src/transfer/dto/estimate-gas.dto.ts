import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsEthereumAddress } from 'class-validator';

export class EstimateGasDto {
  @ApiProperty({ description: 'Recipient address', example: '0x...' })
  @IsEthereumAddress()
  to: string;

  @ApiProperty({ description: 'Amount of ETH to transfer', example: '0.001' })
  @IsString()
  amount: string;

  @ApiProperty({ description: 'Call data (optional)', required: false })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiProperty({
    description: 'Node indices for BLS signature (1-based)',
    example: [1, 2, 3],
    required: false,
  })
  @IsOptional()
  @IsArray()
  nodeIndices?: number[];
}