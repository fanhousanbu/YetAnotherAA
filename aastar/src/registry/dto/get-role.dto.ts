import { ApiProperty } from "@nestjs/swagger";
import { IsEthereumAddress, IsOptional } from "class-validator";

export class GetRoleDto {
  @ApiProperty({
    description: "Ethereum address to query (defaults to authenticated user)",
    example: "0x1234567890123456789012345678901234567890",
    required: false,
  })
  @IsOptional()
  @IsEthereumAddress()
  address?: string;
}

export class RoleResponseDto {
  @ApiProperty({ example: "0x1234...abcd" })
  address: string;

  @ApiProperty({ example: false })
  isAdmin: boolean;

  @ApiProperty({ example: true })
  isCommunityAdmin: boolean;

  @ApiProperty({ example: false })
  isSPO: boolean;

  @ApiProperty({ example: false })
  isV4Operator: boolean;

  @ApiProperty({ example: false })
  isEndUser: boolean;

  @ApiProperty({ type: [String], example: [] })
  roleIds: string[];

  @ApiProperty({ description: "GToken balance in wei", example: "1000000000000000000" })
  gtokenBalance: string;
}

export class RegistryInfoResponseDto {
  @ApiProperty({ example: "0x7Ba70C5bFDb3A4d0cBd220534f3BE177fefc1788" })
  registryAddress: string;

  @ApiProperty({ example: 11155111 })
  chainId: number;

  @ApiProperty({
    example: { communityAdmin: "3", spo: "5", v4Operator: "2", endUser: "20" },
  })
  roleCounts: Record<string, string>;
}
