import { Controller, Get, Post, Body, Param, UseGuards, Query, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TokenService } from "./token.service";
import { AccountService } from "../account/account.service";

@ApiTags("tokens")
@Controller("tokens")
export class TokenController {
  constructor(
    private readonly tokenService: TokenService,
    private readonly accountService: AccountService
  ) {}

  @Get("preset")
  @ApiOperation({ summary: "Get preset token list" })
  @ApiResponse({
    status: 200,
    description: "List of preset tokens",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          address: { type: "string" },
          symbol: { type: "string" },
          name: { type: "string" },
          decimals: { type: "number" },
          logoUrl: { type: "string" },
          isCustom: { type: "boolean" },
          chainId: { type: "number" },
        },
      },
    },
  })
  async getPresetTokens() {
    return this.tokenService.getPresetTokens();
  }

  @Get("info/:address")
  @ApiOperation({ summary: "Get token information" })
  @ApiParam({ name: "address", description: "Token contract address" })
  @ApiResponse({
    status: 200,
    description: "Token information",
    schema: {
      type: "object",
      properties: {
        address: { type: "string" },
        symbol: { type: "string" },
        name: { type: "string" },
        decimals: { type: "number" },
        isCustom: { type: "boolean" },
        chainId: { type: "number" },
      },
    },
  })
  async getTokenInfo(@Param("address") address: string) {
    return this.tokenService.getTokenInfo(address);
  }

  @Post("validate")
  @ApiOperation({ summary: "Validate token address" })
  @ApiResponse({
    status: 200,
    description: "Token validation result",
    schema: {
      type: "object",
      properties: {
        isValid: { type: "boolean" },
        token: {
          type: "object",
          properties: {
            address: { type: "string" },
            symbol: { type: "string" },
            name: { type: "string" },
            decimals: { type: "number" },
          },
        },
      },
    },
  })
  async validateToken(@Body() body: { address: string }) {
    const isValid = await this.tokenService.validateToken(body.address);
    
    if (isValid) {
      const token = await this.tokenService.getTokenInfo(body.address);
      return { isValid: true, token };
    }
    
    return { isValid: false, token: null };
  }

  @Get("balance/:address")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get token balance for user's account" })
  @ApiParam({ name: "address", description: "Token contract address" })
  @ApiResponse({
    status: 200,
    description: "Token balance information",
    schema: {
      type: "object",
      properties: {
        token: {
          type: "object",
          properties: {
            address: { type: "string" },
            symbol: { type: "string" },
            name: { type: "string" },
            decimals: { type: "number" },
          },
        },
        balance: { type: "string" },
        formattedBalance: { type: "string" },
      },
    },
  })
  async getTokenBalance(@Param("address") tokenAddress: string, @Request() req) {
    // Get user's account address from AccountService
    const accountAddress = await this.accountService.getAccountAddress(req.user.sub);
    
    if (!accountAddress) {
      throw new Error("User account not found. Please create an account first.");
    }

    return this.tokenService.getFormattedTokenBalance(tokenAddress, accountAddress);
  }

  @Get("balances")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get all token balances for user's account" })
  @ApiQuery({ 
    name: "address", 
    description: "Account address (optional, uses user's account if not provided)",
    required: false 
  })
  @ApiResponse({
    status: 200,
    description: "All token balances",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          token: {
            type: "object",
            properties: {
              address: { type: "string" },
              symbol: { type: "string" },
              name: { type: "string" },
              decimals: { type: "number" },
            },
          },
          balance: { type: "string" },
          formattedBalance: { type: "string" },
        },
      },
    },
  })
  async getAllTokenBalances(@Request() req, @Query("address") accountAddress?: string) {
    // Use provided address or get user's account address
    const address = accountAddress || await this.accountService.getAccountAddress(req.user.sub);
    
    if (!address) {
      throw new Error("Account address not found. Please create an account first.");
    }

    return this.tokenService.getAllTokenBalances(address);
  }
}