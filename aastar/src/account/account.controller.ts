import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { FundAccountDto } from './dto/fund-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('account')
@Controller('account')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AccountController {
  constructor(private accountService: AccountService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create ERC-4337 account for user' })
  async createAccount(@Request() req, @Body() createAccountDto: CreateAccountDto) {
    return this.accountService.createAccount(req.user.sub, createAccountDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get user account information' })
  async getAccount(@Request() req) {
    return this.accountService.getAccount(req.user.sub);
  }

  @Get('address')
  @ApiOperation({ summary: 'Get account address' })
  async getAddress(@Request() req) {
    const address = await this.accountService.getAccountAddress(req.user.sub);
    return { address };
  }

  @Get('balance')
  @ApiOperation({ summary: 'Get account balance' })
  async getBalance(@Request() req) {
    return this.accountService.getAccountBalance(req.user.sub);
  }

  @Get('nonce')
  @ApiOperation({ summary: 'Get account nonce' })
  async getNonce(@Request() req) {
    return this.accountService.getAccountNonce(req.user.sub);
  }

  @Post('fund')
  @ApiOperation({ summary: 'Fund account with ETH' })
  async fundAccount(@Request() req, @Body() fundAccountDto: FundAccountDto) {
    return this.accountService.fundAccount(req.user.sub, fundAccountDto.amount);
  }
}