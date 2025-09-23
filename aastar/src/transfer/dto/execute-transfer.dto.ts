import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsOptional, IsEthereumAddress, IsBoolean, IsObject } from "class-validator";

export class ExecuteTransferDto {
  @ApiProperty({ description: "Recipient address", example: "0x..." })
  @IsEthereumAddress()
  to: string;

  @ApiProperty({ description: "Amount to transfer", example: "0.001" })
  @IsString()
  amount: string;

  @ApiProperty({
    description: "Token contract address (optional, if not provided, transfers ETH)",
    required: false,
  })
  @IsOptional()
  @IsEthereumAddress()
  tokenAddress?: string;

  @ApiProperty({ description: "Call data (optional)", required: false })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiProperty({
    description: "Use Paymaster for gas sponsorship",
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  usePaymaster?: boolean;

  @ApiProperty({
    description: "Paymaster address (optional, uses default if not provided)",
    required: false,
  })
  @IsOptional()
  @IsEthereumAddress()
  paymasterAddress?: string;

  @ApiProperty({ description: "Additional Paymaster data (optional)", required: false })
  @IsOptional()
  @IsString()
  paymasterData?: string;

  @ApiProperty({
    description: "Passkey verification credential (required for transaction verification)",
    required: true
  })
  @IsObject()
  passkeyCredential: any;
}
