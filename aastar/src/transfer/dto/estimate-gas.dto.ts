import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsEthereumAddress } from "class-validator";

export class EstimateGasDto {
  @ApiProperty({ description: "Recipient address", example: "0x..." })
  @IsEthereumAddress()
  to: string;

  @ApiProperty({ description: "Amount to transfer", example: "0.001" })
  @IsString()
  amount: string;

  @ApiProperty({
    description: "Token contract address (optional, if not provided, estimates ETH transfer)",
    required: false,
  })
  @IsOptional()
  @IsEthereumAddress()
  tokenAddress?: string;

  @ApiProperty({ description: "Call data (optional)", required: false })
  @IsOptional()
  @IsString()
  data?: string;
}
