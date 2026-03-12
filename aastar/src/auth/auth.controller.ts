import { Controller, Post, Body, Get, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { LocalAuthGuard } from "./guards/local-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  @ApiOperation({ summary: "Register a new user" })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post("login")
  @ApiOperation({ summary: "Password login (fallback)" })
  @UseGuards(LocalAuthGuard)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get("profile")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user profile" })
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.sub);
  }

  @Post("refresh")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Refresh token" })
  async refresh(@Request() req) {
    return {
      access_token: this.authService["generateToken"](req.user),
    };
  }

  // ── KMS Passkey Login ──────────────────────────────────────────

  @Post("login/kms/begin")
  @ApiOperation({
    summary: "Begin KMS Passkey login",
    description:
      "Returns a loginHash and walletAddress. Frontend uses walletAddress " +
      "to call KMS BeginAuthentication, then submits the credential back.",
  })
  async beginKmsLogin(@Body() body: { email: string }) {
    return this.authService.generateLoginChallenge(body.email);
  }

  @Post("login/kms/complete")
  @ApiOperation({
    summary: "Complete KMS Passkey login",
    description:
      "Backend calls KMS SignHash with the WebAuthn credential to verify " +
      "the user's identity, then issues a JWT.",
  })
  async completeKmsLogin(
    @Body() body: { address: string; challengeId: string; credential: any },
  ) {
    return this.authService.verifyKmsLogin(
      body.address,
      body.challengeId,
      body.credential,
    );
  }

  // ── Wallet Linking ─────────────────────────────────────────────

  @Post("wallet/link")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Link KMS wallet to user account",
    description:
      "Called after KMS key creation and address derivation. " +
      "Associates the KMS key with the authenticated user.",
  })
  async linkWallet(
    @Request() req,
    @Body()
    body: {
      kmsKeyId: string;
      address: string;
      credentialId?: string;
    },
  ) {
    return this.authService.linkWallet(
      req.user.sub,
      body.kmsKeyId,
      body.address,
      body.credentialId,
    );
  }
}
