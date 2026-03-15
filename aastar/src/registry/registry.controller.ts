import { Controller, Get, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RegistryService } from "./registry.service";
import { RoleResponseDto, RegistryInfoResponseDto } from "./dto/get-role.dto";
import type { Address, Hex } from "viem";

@ApiTags("registry")
@Controller("registry")
export class RegistryController {
  constructor(private readonly registryService: RegistryService) {}

  @Get("info")
  @ApiOperation({ summary: "Get registry contract info and role member counts" })
  @ApiResponse({ status: 200, type: RegistryInfoResponseDto })
  async getRegistryInfo(): Promise<RegistryInfoResponseDto> {
    return this.registryService.getRegistryInfo();
  }

  @Get("role-ids")
  @ApiOperation({ summary: "Get all role ID hashes" })
  getRoleIds() {
    return this.registryService.getRoleIds();
  }

  @Get("role")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get role info for an address (defaults to authenticated user)" })
  @ApiQuery({ name: "address", required: false, description: "Ethereum address" })
  @ApiResponse({ status: 200, type: RoleResponseDto })
  async getRole(@Request() req, @Query("address") address?: string): Promise<RoleResponseDto> {
    const targetAddress = (address || req.user?.walletAddress) as Address | undefined;

    if (!targetAddress) {
      return {
        address: "0x" as Address,
        isAdmin: false,
        isCommunityAdmin: false,
        isSPO: false,
        isV4Operator: false,
        isEndUser: false,
        roleIds: [],
        gtokenBalance: "0",
      };
    }

    const [roles, gtokenBalance] = await Promise.all([
      this.registryService.getUserRoles(targetAddress),
      this.registryService.getGTokenBalance(targetAddress),
    ]);

    return {
      address: targetAddress,
      ...roles,
      roleIds: roles.roleIds as string[],
      gtokenBalance: gtokenBalance.toString(),
    };
  }

  @Get("members")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get role members" })
  @ApiQuery({ name: "roleId", required: true, description: "Role ID hash (bytes32)" })
  async getRoleMembers(@Query("roleId") roleId: string) {
    const members = await this.registryService.getRoleMembers(roleId as Hex);
    const count = await this.registryService.getRoleUserCount(roleId as Hex);
    return { roleId, count: count.toString(), members };
  }

  @Get("community")
  @ApiOperation({ summary: "Look up community contract address by name" })
  @ApiQuery({ name: "name", required: true, description: "Community name" })
  async getCommunityByName(@Query("name") name: string) {
    const address = await this.registryService.getCommunityByName(name);
    return { name, address };
  }
}
