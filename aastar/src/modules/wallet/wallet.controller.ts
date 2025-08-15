import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { ExportPrivateKeyDto } from './dto/wallet.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @ApiOperation({ summary: 'Get wallet information' })
  @ApiResponse({ 
    status: 200, 
    description: 'Wallet information retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string' },
        balance: { type: 'string' },
        createdAt: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  @Get('info')
  async getWalletInfo(@Request() req) {
    return this.walletService.getWalletInfo(req.user.sub);
  }

  @ApiOperation({ summary: 'Get wallet balance' })
  @ApiResponse({ 
    status: 200, 
    description: 'Balance retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        balance: { type: 'string', description: 'Balance in wei' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  @Get('balance')
  async getBalance(@Request() req) {
    return this.walletService.getWalletBalance(req.user.sub);
  }

  @ApiOperation({ summary: 'Get wallet address' })
  @ApiResponse({ 
    status: 200, 
    description: 'Address retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  @Get('address')
  async getAddress(@Request() req) {
    return this.walletService.getWalletAddress(req.user.sub);
  }

  @ApiOperation({ summary: 'Export private key (requires email verification)' })
  @ApiResponse({ 
    status: 200, 
    description: 'Private key exported successfully',
    schema: {
      type: 'object',
      properties: {
        privateKey: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid verification code or email mismatch' })
  @ApiResponse({ status: 404, description: 'Wallet not found' })
  @Post('export-private-key')
  async exportPrivateKey(@Request() req, @Body() exportDto: ExportPrivateKeyDto) {
    return this.walletService.exportPrivateKey(
      req.user.sub,
      exportDto.email,
      exportDto.verificationCode
    );
  }

  @ApiOperation({ summary: 'Get available BLS signer nodes' })
  @ApiResponse({ 
    status: 200, 
    description: 'Available BLS signers retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        signers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              nodeId: { type: 'string' },
              endpoint: { type: 'string' },
              status: { type: 'string' },
              lastSeen: { type: 'string' },
              capabilities: { type: 'array', items: { type: 'string' } }
            }
          }
        },
        count: { type: 'number' }
      }
    }
  })
  @Get('bls/signers')
  async getAvailableSigners(@Request() req) {
    const signers = await this.walletService.getAvailableSigners();
    return {
      signers,
      count: signers.length
    };
  }

  @ApiOperation({ summary: 'Sign message using BLS aggregated signature' })
  @ApiResponse({ 
    status: 200, 
    description: 'BLS signature created successfully',
    schema: {
      type: 'object',
      properties: {
        aggregatedSignature: { type: 'string' },
        signers: { type: 'array', items: { type: 'string' } },
        publicKeys: { type: 'array', items: { type: 'string' } },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Insufficient signers or signature failed' })
  @Post('bls/sign')
  async signWithBLS(@Request() req, @Body() body: { message: string; signerCount?: number }) {
    const result = await this.walletService.signMessageWithBLS(
      req.user.sub,
      body.message,
      body.signerCount || 3
    );
    return {
      ...result,
      message: body.message
    };
  }

  @ApiOperation({ summary: 'Verify BLS aggregated signature' })
  @ApiResponse({ 
    status: 200, 
    description: 'BLS signature verification result',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean' },
        verifiedBy: { type: 'string' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Verification failed' })
  @Post('bls/verify')
  async verifyBLS(@Request() req, @Body() body: { 
    message: string; 
    aggregatedSignature: string; 
    publicKeys: string[] 
  }) {
    const result = await this.walletService.verifyBLSSignature(
      body.message,
      body.aggregatedSignature,
      body.publicKeys
    );
    return {
      ...result,
      message: body.message
    };
  }
}