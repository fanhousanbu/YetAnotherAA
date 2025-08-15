import { ApiProperty } from '@nestjs/swagger';

export class WalletInfoDto {
  @ApiProperty({
    description: 'Wallet address',
    example: '0x742d35Cc6542C4532581Ed51901C8B8b9c2d0E88'
  })
  address: string;

  @ApiProperty({
    description: 'ETH balance in wei',
    example: '1000000000000000000'
  })
  balance: string;

  @ApiProperty({
    description: 'Wallet creation date',
    example: '2023-01-01T00:00:00.000Z'
  })
  createdAt: Date;
}

export class ExportPrivateKeyDto {
  @ApiProperty({
    description: 'User email for verification',
    example: 'user@example.com'
  })
  email: string;

  @ApiProperty({
    description: 'Email verification code',
    example: '123456'
  })
  verificationCode: string;
}