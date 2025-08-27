import { ApiProperty } from '@nestjs/swagger';

export class BaseResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message', required: false })
  message?: string;

  @ApiProperty({ description: 'Response data', required: false })
  data?: any;

  @ApiProperty({ description: 'Error details', required: false })
  error?: any;
}

export class PaginationDto {
  @ApiProperty({ description: 'Page number', default: 1 })
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', default: 10 })
  limit?: number = 10;
}