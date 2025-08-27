import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsArray, IsOptional } from "class-validator";

export class GenerateBlsSignatureDto {
  @ApiProperty({ description: "UserOperation hash to sign" })
  @IsString()
  userOpHash: string;

  @ApiProperty({
    description: "Node indices to use for signing (1-based)",
    example: [1, 2, 3],
    required: false,
  })
  @IsOptional()
  @IsArray()
  nodeIndices?: number[];
}
