import { IsString, IsNotEmpty, IsEmail, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterBeginDto {
  @ApiProperty({
    description: 'Email address',
    example: 'user@example.com'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    description: 'Email verification code',
    example: '123456'
  })
  @IsString()
  @IsNotEmpty()
  verificationCode: string;
}

export class RegisterCompleteDto {
  @ApiProperty({
    description: 'Challenge string from register/begin',
    example: 'base64url-encoded-challenge'
  })
  @IsString()
  @IsNotEmpty()
  challenge: string;

  @ApiProperty({
    description: 'WebAuthn credential response',
    example: {
      id: 'credential-id',
      rawId: 'raw-credential-id',
      response: {
        attestationObject: '...',
        clientDataJSON: '...'
      },
      type: 'public-key'
    }
  })
  @IsObject()
  @IsNotEmpty()
  credential: any;
}

export class LoginBeginDto {
  @ApiProperty({
    description: 'Email address',
    example: 'user@example.com'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}

export class LoginCompleteDto {
  @ApiProperty({
    description: 'Challenge string from login/begin',
    example: 'base64url-encoded-challenge'
  })
  @IsString()
  @IsNotEmpty()
  challenge: string;

  @ApiProperty({
    description: 'WebAuthn credential response',
    example: {
      id: 'credential-id',
      rawId: 'raw-credential-id',
      response: {
        authenticatorData: '...',
        clientDataJSON: '...',
        signature: '...'
      },
      type: 'public-key'
    }
  })
  @IsObject()
  @IsNotEmpty()
  credential: any;
}