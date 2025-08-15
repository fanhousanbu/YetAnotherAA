import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SignatureService } from './signature.service.js';
import { SignMessageDto } from '../../dto/sign.dto.js';
import { AggregateSignatureDto } from '../../dto/aggregate.dto.js';
import { IsString, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifySignatureDto {
  @ApiProperty({
    description: 'The aggregated BLS signature to verify',
    example: '0x1234567890abcdef...'
  })
  @IsString()
  signature: string;

  @ApiProperty({
    description: 'Array of public keys used in the aggregated signature',
    type: [String],
    example: ['0x8052464ad7afdeaa...', '0x8338213c412750cf...']
  })
  @IsArray()
  @IsString({ each: true })
  publicKeys: string[];

  @ApiProperty({
    description: 'The original message that was signed',
    example: 'Hello, BLS signatures!'
  })
  @IsString()
  message: string;
}

@ApiTags('signature')
@Controller('signature')
export class SignatureController {
  constructor(private readonly signatureService: SignatureService) {}

  @ApiOperation({ summary: 'Sign a message with current node' })
  @ApiResponse({ 
    status: 200, 
    description: 'Message signed successfully',
    schema: {
      type: 'object',
      properties: {
        nodeId: { type: 'string', description: 'ID of the node that signed the message' },
        signature: { type: 'string', description: 'BLS signature in hex format' },
        publicKey: { type: 'string', description: 'Public key of the signing node' },
        message: { type: 'string', description: 'Original message that was signed' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiBody({ type: SignMessageDto })
  @Post('sign')
  async signMessage(@Body(ValidationPipe) signDto: SignMessageDto) {
    return await this.signatureService.signMessage(signDto.message);
  }

  @ApiOperation({ summary: 'Aggregate multiple BLS signatures' })
  @ApiResponse({ 
    status: 200, 
    description: 'Signatures aggregated successfully',
    schema: {
      type: 'object',
      properties: {
        signature: { type: 'string', description: 'Aggregated BLS signature' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiBody({ type: AggregateSignatureDto })
  @Post('aggregate')
  async aggregateSignatures(@Body(ValidationPipe) aggregateDto: AggregateSignatureDto) {
    return await this.signatureService.aggregateExternalSignatures(aggregateDto.signatures);
  }

  @ApiOperation({ summary: 'Verify an aggregated BLS signature' })
  @ApiResponse({ 
    status: 200, 
    description: 'Signature verification result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', description: 'Whether the signature is valid' },
        message: { type: 'string', description: 'Verification message' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiBody({ type: VerifySignatureDto })
  @Post('verify')
  async verifySignature(@Body(ValidationPipe) verifyDto: VerifySignatureDto) {
    return await this.signatureService.verifyAggregatedSignature(
      verifyDto.signature,
      verifyDto.publicKeys,
      verifyDto.message
    );
  }
}