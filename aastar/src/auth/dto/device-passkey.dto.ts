import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsObject } from 'class-validator';

export class DevicePasskeyBeginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}

export class DevicePasskeyRegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;

  @ApiProperty({ description: 'WebAuthn credential response' })
  @IsObject()
  credential: any;
}