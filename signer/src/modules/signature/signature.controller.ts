import { Controller, Post, Body, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { SignatureService } from './signature.service.js';
import { SignMessageDto, AggregateSignatureDto } from '../../dto/sign.dto.js';

@ApiTags('signature')
@Controller('signature')
export class SignatureController {
  constructor(private readonly signatureService: SignatureService) {}

  @ApiOperation({ summary: 'Sign a message with a single node' })
  @ApiResponse({ 
    status: 200, 
    description: 'Message signed successfully',
    schema: {
      type: 'object',
      properties: {
        signature: { type: 'string', description: 'BLS signature in hex format' },
        nodeId: { type: 'string', description: 'ID of the node that signed the message' },
        publicKey: { type: 'string', description: 'Public key of the signing node' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Node not found' })
  @ApiBody({ type: SignMessageDto })
  @Post('sign')
  async signMessage(@Body(ValidationPipe) signDto: SignMessageDto) {
    return await this.signatureService.signMessage(signDto.message, signDto.nodeId);
  }

  @ApiOperation({ summary: 'Aggregate signatures from multiple nodes' })
  @ApiResponse({ 
    status: 200, 
    description: 'Signatures aggregated successfully',
    schema: {
      type: 'object',
      properties: {
        aggregatedSignature: { type: 'string', description: 'Aggregated BLS signature in hex format' },
        aggregatedPublicKey: { type: 'string', description: 'Aggregated public key in hex format' },
        nodeIds: { type: 'array', items: { type: 'string' }, description: 'IDs of nodes that participated in aggregation' },
        message: { type: 'string', description: 'Original message that was signed' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'One or more nodes not found' })
  @ApiBody({ type: AggregateSignatureDto })
  @Post('aggregate')
  async aggregateSignatures(@Body(ValidationPipe) aggregateDto: AggregateSignatureDto) {
    return await this.signatureService.aggregateSignatures(aggregateDto.message, aggregateDto.nodeIds);
  }
}