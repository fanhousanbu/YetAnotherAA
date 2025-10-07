import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty } from "class-validator";

export class ExportDataDto {
  @ApiProperty({ description: "Password for data export" })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ImportDataDto {
  @ApiProperty({ description: "Password for data import" })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: "Base64 encoded data to import" })
  @IsString()
  @IsNotEmpty()
  data: string;
}
