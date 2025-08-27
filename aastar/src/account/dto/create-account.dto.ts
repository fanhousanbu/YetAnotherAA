import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsNumber, IsBoolean, IsString } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ description: 'Salt for deterministic address generation', required: false })
  @IsOptional()
  @IsNumber()
  salt?: number;

  @ApiProperty({ description: 'Deploy account on-chain immediately', default: false })
  @IsOptional()
  @IsBoolean()
  deploy?: boolean;

  @ApiProperty({ description: 'Amount of ETH to fund the account with', required: false })
  @IsOptional()
  @IsString()
  fundAmount?: string;
}