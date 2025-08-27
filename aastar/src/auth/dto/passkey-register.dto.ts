import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, IsOptional } from 'class-validator';

export class PasskeyRegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'john_doe', required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;

  @ApiProperty()
  credential: any;
}

export class PasskeyRegisterBeginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'john_doe', required: false })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}