import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PasskeyRegisterBeginDto, PasskeyRegisterDto } from './dto/passkey-register.dto';
import { PasskeyLoginBeginDto, PasskeyLoginDto } from './dto/passkey-login.dto';
import { DevicePasskeyBeginDto, DevicePasskeyRegisterDto } from './dto/device-passkey.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ summary: 'User login' })
  @UseGuards(LocalAuthGuard)
  async login(@Body() loginDto: LoginDto, @Request() req) {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user profile' })
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.sub);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh token' })
  async refresh(@Request() req) {
    return {
      access_token: this.authService['generateToken'](req.user),
    };
  }

  // Passkey注册相关API
  @Post('passkey/register/begin')
  @ApiOperation({ summary: 'Begin passkey registration' })
  async beginPasskeyRegistration(@Body() beginDto: PasskeyRegisterBeginDto) {
    return this.authService.beginPasskeyRegistration(beginDto);
  }

  @Post('passkey/register/complete')
  @ApiOperation({ summary: 'Complete passkey registration' })
  async completePasskeyRegistration(@Body() registerDto: PasskeyRegisterDto) {
    return this.authService.completePasskeyRegistration(registerDto);
  }

  // Passkey登录相关API
  @Post('passkey/login/begin')
  @ApiOperation({ summary: 'Begin passkey login' })
  async beginPasskeyLogin() {
    return this.authService.beginPasskeyLogin();
  }

  @Post('passkey/login/complete')
  @ApiOperation({ summary: 'Complete passkey login' })
  async completePasskeyLogin(@Body() loginDto: PasskeyLoginDto) {
    return this.authService.completePasskeyLogin(loginDto);
  }

  // 新设备Passkey注册相关API
  @Post('device/passkey/begin')
  @ApiOperation({ summary: 'Begin device passkey registration' })
  async beginDevicePasskeyRegistration(@Body() beginDto: DevicePasskeyBeginDto) {
    return this.authService.beginDevicePasskeyRegistration(beginDto);
  }

  @Post('device/passkey/complete')
  @ApiOperation({ summary: 'Complete device passkey registration' })
  async completeDevicePasskeyRegistration(@Body() registerDto: DevicePasskeyRegisterDto) {
    return this.authService.completeDevicePasskeyRegistration(registerDto);
  }
}