import { Controller, Post, Get, Body, UseGuards, Request, HttpStatus, Res } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from "@nestjs/swagger";
import { AccountService } from "./account.service";
import { CreateAccountDto } from "./dto/create-account.dto";
import { RotateSignerDto } from "./dto/rotate-signer.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("account")
@Controller("account")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountController {
  constructor(private accountService: AccountService) {}

  @Post("create")
  @ApiOperation({ summary: "Create ERC-4337 account for user" })
  async createAccount(@Request() req, @Body() createAccountDto: CreateAccountDto) {
    return this.accountService.createAccount(req.user.sub, createAccountDto);
  }

  @Get()
  @ApiOperation({ summary: "Get user account information" })
  @ApiResponse({ status: 200, description: "Account found" })
  @ApiResponse({ status: 204, description: "No account exists for user" })
  async getAccount(@Request() req, @Res() res) {
    console.log("AccountController.getAccount called");
    console.log("User from JWT:", req.user);

    const accountData = await this.accountService.getAccount(req.user.sub);

    if (accountData === null) {
      console.log("No account found - returning 204 No Content");
      return res.status(HttpStatus.NO_CONTENT).send();
    }

    console.log("Account data retrieved successfully");
    return res.status(HttpStatus.OK).json(accountData);
  }

  @Get("address")
  @ApiOperation({ summary: "Get account address" })
  async getAddress(@Request() req) {
    const address = await this.accountService.getAccountAddress(req.user.sub);
    return { address };
  }

  @Get("balance")
  @ApiOperation({ summary: "Get account balance" })
  async getBalance(@Request() req) {
    return this.accountService.getAccountBalance(req.user.sub);
  }

  @Get("nonce")
  @ApiOperation({ summary: "Get account nonce" })
  async getNonce(@Request() req) {
    return this.accountService.getAccountNonce(req.user.sub);
  }

  @Post("rotate-signer")
  @ApiOperation({
    summary: "Update the off-chain signer address (Phase 1: Owner Rotation)",
    description:
      "Updates the signerAddress record in the backend. " +
      "To fully rotate on-chain, also submit a UserOp calling updateSigner() on the account contract.",
  })
  async rotateSigner(@Request() req, @Body() dto: RotateSignerDto) {
    return this.accountService.rotateSigner(req.user.sub, dto.newSignerAddress);
  }

  // fund and sponsor endpoints removed - not needed with Paymaster
  // All transactions are sponsored by Paymaster
}
