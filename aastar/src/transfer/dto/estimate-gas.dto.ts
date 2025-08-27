import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsArray, IsOptional, IsEthereumAddress } from "class-validator";

export class EstimateGasDto {
  @ApiProperty({ description: "Recipient address", example: "0x..." })
  @IsEthereumAddress()
  to: string;

  @ApiProperty({ description: "Amount of ETH to transfer", example: "0.001" })
  @IsString()
  amount: string;

  @ApiProperty({ description: "Call data (optional)", required: false })
  @IsOptional()
  @IsString()
  data?: string;
}
