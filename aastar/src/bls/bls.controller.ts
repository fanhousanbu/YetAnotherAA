import { Controller, Get, Post, Body, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { BlsService } from "./bls.service";
import { GenerateBlsSignatureDto } from "./dto/generate-bls-signature.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("bls")
@Controller("bls")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BlsController {
  constructor(private blsService: BlsService) {}

  @Get("nodes")
  @ApiOperation({ summary: "Get available BLS nodes" })
  async getNodes() {
    return await this.blsService.getAvailableNodes();
  }

  @Post("sign")
  @ApiOperation({ summary: "Generate BLS aggregate signature" })
  async generateSignature(
    @Request() req,
    @Body() generateBlsSignatureDto: GenerateBlsSignatureDto
  ) {
    return this.blsService.generateBLSSignature(
      req.user.sub,
      generateBlsSignatureDto.userOpHash,
      generateBlsSignatureDto.nodeIndices
    );
  }

  @Post("aggregate")
  @ApiOperation({ summary: "Aggregate BLS signatures (utility endpoint)" })
  async aggregateSignatures(@Body() body: any) {
    // This is a utility endpoint for testing/debugging
    // In production, aggregation happens automatically in generateBLSSignature
    return {
      message: "Aggregation happens automatically in the sign endpoint",
      data: body,
    };
  }
}
