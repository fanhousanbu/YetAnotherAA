import { ApiProperty } from "@nestjs/swagger";
import { IsEthereumAddress, IsNotEmpty } from "class-validator";

export class AddGuardianDto {
  @ApiProperty({ description: "Ethereum address of the guardian to add" })
  @IsEthereumAddress()
  @IsNotEmpty()
  guardianAddress: string;
}

export class RemoveGuardianDto {
  @ApiProperty({ description: "Ethereum address of the guardian to remove" })
  @IsEthereumAddress()
  @IsNotEmpty()
  guardianAddress: string;
}

export class InitiateRecoveryDto {
  @ApiProperty({ description: "Account address to recover" })
  @IsEthereumAddress()
  @IsNotEmpty()
  accountAddress: string;

  @ApiProperty({ description: "New signer address to transfer control to" })
  @IsEthereumAddress()
  @IsNotEmpty()
  newSignerAddress: string;
}

export class SupportRecoveryDto {
  @ApiProperty({ description: "Account address whose recovery to support" })
  @IsEthereumAddress()
  @IsNotEmpty()
  accountAddress: string;
}

export class ExecuteRecoveryDto {
  @ApiProperty({ description: "Account address to execute recovery for" })
  @IsEthereumAddress()
  @IsNotEmpty()
  accountAddress: string;
}

export class CancelRecoveryDto {
  @ApiProperty({ description: "Account address whose recovery to cancel" })
  @IsEthereumAddress()
  @IsNotEmpty()
  accountAddress: string;
}
