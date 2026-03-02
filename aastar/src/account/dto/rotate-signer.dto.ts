import { ApiProperty } from "@nestjs/swagger";
import { IsEthereumAddress, IsNotEmpty } from "class-validator";

export class RotateSignerDto {
  @ApiProperty({ description: "New signer Ethereum address" })
  @IsEthereumAddress()
  @IsNotEmpty()
  newSignerAddress: string;
}
