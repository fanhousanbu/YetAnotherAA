import { Controller, Get, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminService } from "./admin.service";
import type { Address } from "viem";

@ApiTags("admin")
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Public Endpoints ─────────────────────────────────────────────────────────

  @Get("protocol")
  @ApiOperation({ summary: "Get protocol overview — registry stats, role configs, GToken" })
  async getProtocol() {
    return this.adminService.getProtocolDashboard();
  }

  @Get("roles")
  @ApiOperation({ summary: "Get all role configurations from Registry" })
  async getRoleConfigs() {
    return this.adminService.getAllRoleConfigs();
  }

  @Get("gtoken")
  @ApiOperation({ summary: "Get GToken stats" })
  async getGTokenStats() {
    return this.adminService.getGTokenStats();
  }

  // ── JWT-Protected Endpoints ──────────────────────────────────────────────────

  @Get("dashboard")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get full protocol admin dashboard (includes isAdmin flag for authenticated user)",
  })
  async getDashboard(@Request() req: any) {
    const userAddress = req.user?.walletAddress as Address | undefined;
    return this.adminService.getProtocolDashboard(userAddress);
  }
}
