import { Controller, Get, Post, Body, UseGuards, Param } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PaymasterService } from "./paymaster.service";
import { AnalyzeTransactionDto } from "./dto/analyze-transaction.dto";

@ApiTags("paymaster")
@Controller("paymaster")
export class PaymasterController {
  constructor(private readonly paymasterService: PaymasterService) {}

  @Get("available")
  @ApiOperation({ summary: "Get available paymaster services" })
  @ApiResponse({
    status: 200,
    description: "List of available paymaster services",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", example: "pimlico-sepolia" },
          address: { type: "string", example: "0x..." },
          configured: { type: "boolean", example: true },
        },
      },
    },
  })
  async getAvailablePaymasters() {
    return this.paymasterService.getAvailablePaymasters();
  }

  @Post("sponsor")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get paymaster sponsorship for a UserOperation" })
  @ApiResponse({
    status: 200,
    description: "Paymaster sponsorship data",
    schema: {
      type: "object",
      properties: {
        paymasterAndData: { type: "string", example: "0x..." },
        sponsored: { type: "boolean", example: true },
      },
    },
  })
  async sponsorUserOperation(
    @Body()
    body: {
      paymasterName: string;
      userOp: any;
      entryPoint?: string;
    }
  ) {
    const entryPoint = body.entryPoint || "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
    const paymasterAndData = await this.paymasterService.getPaymasterData(
      body.paymasterName,
      body.userOp,
      entryPoint
    );

    return {
      paymasterAndData,
      sponsored: paymasterAndData !== "0x",
    };
  }

  @Get("analyze/:txHash")
  @ApiOperation({ summary: "Analyze if a transaction used Paymaster" })
  @ApiResponse({
    status: 200,
    description: "Transaction analysis result",
    schema: {
      type: "object",
      properties: {
        txHash: { type: "string" },
        isERC4337: { type: "boolean" },
        usedPaymaster: { type: "boolean" },
        paymasterAddress: { type: "string", nullable: true },
        bundlerAddress: { type: "string" },
        userOpHash: { type: "string", nullable: true },
        gasUsed: { type: "string" },
        gasPaidBy: { type: "string" },
        details: { type: "object" },
      },
    },
  })
  async analyzeTransaction(@Param("txHash") txHash: string) {
    return this.paymasterService.analyzeTransaction(txHash);
  }
}
