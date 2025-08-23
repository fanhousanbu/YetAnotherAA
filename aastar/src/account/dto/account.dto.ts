import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ 
    description: '账户所有者私钥', 
    example: '0x1234567890abcdef...' 
  })
  @IsString()
  @IsNotEmpty()
  privateKey: string;

  @ApiProperty({ 
    description: '是否使用AAStarValidator', 
    default: false,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  useAAStarValidator?: boolean;

  @ApiProperty({ 
    description: '账户创建盐值', 
    default: '12345',
    required: false
  })
  @IsOptional()
  @IsString()
  salt?: string;
}

export class GetAccountDto {
  @ApiProperty({ 
    description: '账户所有者私钥', 
    example: '0x1234567890abcdef...' 
  })
  @IsString()
  @IsNotEmpty()
  privateKey: string;

  @ApiProperty({ 
    description: '是否使用AAStarValidator', 
    default: false,
    required: false
  })
  @IsOptional()
  @IsBoolean()
  useAAStarValidator?: boolean;

  @ApiProperty({ 
    description: '账户创建盐值', 
    default: '12345',
    required: false
  })
  @IsOptional()
  @IsString()
  salt?: string;
}

export class AccountInfoDto {
  @ApiProperty({ description: '账户地址' })
  address: string;

  @ApiProperty({ description: '是否已部署' })
  isDeployed: boolean;

  @ApiProperty({ description: '账户余额(ETH)' })
  balance: string;

  @ApiProperty({ description: '验证器配置' })
  validationConfig: {
    validator: string;
    isCustom: boolean;
    accountOwner: string;
  };
}

export class UpdateValidatorDto {
  @ApiProperty({ 
    description: '账户所有者私钥', 
    example: '0x1234567890abcdef...' 
  })
  @IsString()
  @IsNotEmpty()
  privateKey: string;

  @ApiProperty({ 
    description: '验证器地址', 
    example: '0x1E0c95946801ef4Fc294eA1F8214faB2357bFF9C' 
  })
  @IsString()
  @IsNotEmpty()
  validatorAddress: string;

  @ApiProperty({ 
    description: '是否使用自定义验证器', 
    default: true
  })
  @IsBoolean()
  useCustomValidator: boolean;
}