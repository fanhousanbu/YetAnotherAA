import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  SendCodeDto,
  VerifyCodeDto,
} from './dto/email.dto';
import {
  RegisterBeginDto,
  RegisterCompleteDto,
  LoginBeginDto,
  LoginCompleteDto,
} from './dto/passkey.dto';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Send email verification code' })
  @ApiResponse({ status: 200, description: 'Verification code sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid email address' })
  @Post('email/send-code')
  async sendVerificationCode(@Body() sendCodeDto: SendCodeDto) {
    return this.authService.sendVerificationCode(sendCodeDto.email);
  }

  @ApiOperation({ summary: 'Verify email verification code' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired verification code' })
  @Post('email/verify-code')
  async verifyEmail(@Body() verifyCodeDto: VerifyCodeDto) {
    return this.authService.verifyEmail(verifyCodeDto.email, verifyCodeDto.code);
  }

  @ApiOperation({ summary: 'Begin Passkey registration' })
  @ApiResponse({ 
    status: 200, 
    description: 'Registration options generated',
    schema: {
      type: 'object',
      properties: {
        challenge: { type: 'string' },
        rp: { type: 'object' },
        user: { type: 'object' },
        pubKeyCredParams: { type: 'array' },
        timeout: { type: 'number' },
        attestation: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Email verification required or user already exists' })
  @Post('passkey/register/begin')
  async beginPasskeyRegistration(@Body() registerBeginDto: RegisterBeginDto) {
    try {
      return await this.authService.beginPasskeyRegistration(
        registerBeginDto.email,
        registerBeginDto.verificationCode
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @ApiOperation({ summary: 'Complete Passkey registration' })
  @ApiResponse({ 
    status: 200, 
    description: 'Registration completed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        userId: { type: 'string' },
        accessToken: { type: 'string' },
        walletAddress: { type: 'string' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Registration failed' })
  @Post('passkey/register/complete')
  async completePasskeyRegistration(@Body() registerCompleteDto: RegisterCompleteDto) {
    return this.authService.completePasskeyRegistration(
      registerCompleteDto.challenge,
      registerCompleteDto.credential
    );
  }

  @ApiOperation({ summary: 'Begin Passkey login' })
  @ApiResponse({ 
    status: 200, 
    description: 'Authentication options generated',
    schema: {
      type: 'object',
      properties: {
        challenge: { type: 'string' },
        allowCredentials: { type: 'array' },
        timeout: { type: 'number' },
        userVerification: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'User not found' })
  @Post('passkey/login/begin')
  async beginPasskeyLogin(@Body() loginBeginDto: LoginBeginDto) {
    try {
      return await this.authService.beginPasskeyLogin(loginBeginDto.email);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @ApiOperation({ summary: 'Complete Passkey login' })
  @ApiResponse({ 
    status: 200, 
    description: 'Login successful',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        userId: { type: 'string' },
        accessToken: { type: 'string' },
        message: { type: 'string' }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Authentication failed' })
  @Post('passkey/login/complete')
  async completePasskeyLogin(@Body() loginCompleteDto: LoginCompleteDto) {
    return this.authService.completePasskeyLogin(
      loginCompleteDto.challenge,
      loginCompleteDto.credential
    );
  }
}