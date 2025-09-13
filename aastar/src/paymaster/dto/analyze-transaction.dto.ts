import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class AnalyzeTransactionDto {
  @ApiProperty({
    description: "Transaction hash to analyze",
    example: "0x9d41220976b090bb694d72020ca2c45b2ebca5b02f27af5f2c48a502e3112267",
  })
  @IsString()
  txHash: string;
}
