import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SignatureService } from './signature.service.js';
import { SignMessageDto } from '../../dto/sign.dto.js';
import { AggregateSignatureDto } from '../../dto/aggregate.dto.js';

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
}