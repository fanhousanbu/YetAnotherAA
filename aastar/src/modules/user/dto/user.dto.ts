import { ApiProperty } from '@nestjs/swagger';

export class UserInfoDto {
  @ApiProperty({
    description: 'User ID',
    example: 'user-uuid-here'
  })
  id: string;

  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com'
  })
  email: string;

  @ApiProperty({
    description: 'Number of registered passkey credentials',
    example: 1
  })
  credentialCount: number;

  @ApiProperty({
    description: 'User registration date',
    example: '2023-01-01T00:00:00.000Z'
  })
  createdAt: Date;
}