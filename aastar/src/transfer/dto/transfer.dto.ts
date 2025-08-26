import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsNumber } from "class-validator";

export class TransferDto {
  @ApiProperty({
    description: "发送方私钥",
    example: "0x1234567890abcdef...",
  })
  @IsString()
  @IsNotEmpty()
  fromPrivateKey: string;

  @ApiProperty({
    description: "接收方地址",
    example: "0x742D35CC7aB8E3e5F8B7D1E8F4a3e7b1a9B2C3D4",
  })
  @IsString()
  @IsNotEmpty()
  toAddress: string;

  @ApiProperty({
    description: "转账金额(ETH)",
    example: "0.001",
  })
  @IsString()
  @IsNotEmpty()
  amount: string;

  @ApiProperty({
    description: "是否使用AAStarValidator",
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  useAAStarValidator?: boolean;

  @ApiProperty({
    description: "BLS节点ID数组(使用AAStarValidator时需要)",
    example: ["0xf26f8bdca182790bad5481c1f0eac3e7ffb135ab33037dd02b8d98a1066c6e5d"],
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  nodeIds?: string[];

  @ApiProperty({
    description: "账户创建盐值",
    default: "12345",
    required: false,
  })
  @IsOptional()
  @IsString()
  salt?: string;
}

export class TransferResultDto {
  @ApiProperty({ description: "UserOperation哈希" })
  userOpHash: string;

  @ApiProperty({ description: "发送方账户地址" })
  accountAddress: string;

  @ApiProperty({ description: "接收方地址" })
  toAddress: string;

  @ApiProperty({ description: "转账金额(ETH)" })
  amount: string;

  @ApiProperty({ description: "交易哈希", required: false })
  transactionHash?: string;

  @ApiProperty({ description: "是否成功" })
  success: boolean;

  @ApiProperty({ description: "Gas使用量", required: false })
  gasUsed?: string;

  @ApiProperty({ description: "错误信息", required: false })
  error?: string;

  @ApiProperty({ description: "使用的验证器类型" })
  validatorType: "ECDSA" | "AAStarValidator";
}
