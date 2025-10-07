import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { UserNFTService, CreateUserNFTDto, UpdateUserNFTDto } from "./user-nft.service";
import { NFTStandard } from "../entities/user-nft.entity";
import { AccountService } from "../account/account.service";

@ApiTags("user-nfts")
@Controller("user-nfts")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserNFTController {
  constructor(
    private readonly userNFTService: UserNFTService,
    private readonly accountService: AccountService
  ) {}

  @Get()
  @ApiOperation({ summary: "Get user's NFT collection" })
  @ApiQuery({
    name: "activeOnly",
    required: false,
    type: "boolean",
    description: "Show only active NFTs",
  })
  @ApiResponse({
    status: 200,
    description: "User's NFT collection",
  })
  async getUserNFTs(@Request() req, @Query("activeOnly") activeOnly?: boolean) {
    const userId = req.user.sub;
    return this.userNFTService.getUserNFTs(userId, activeOnly !== false);
  }

  @Get("stats")
  @ApiOperation({ summary: "Get user's NFT statistics" })
  @ApiResponse({
    status: 200,
    description: "NFT statistics",
  })
  async getNFTStats(@Request() req) {
    const userId = req.user.sub;
    return this.userNFTService.getNFTStats(userId);
  }

  @Get("collection/:contractAddress")
  @ApiOperation({ summary: "Get NFTs from a specific collection" })
  @ApiParam({ name: "contractAddress", description: "NFT contract address" })
  @ApiResponse({
    status: 200,
    description: "NFTs from the collection",
  })
  async getNFTsByCollection(@Request() req, @Param("contractAddress") contractAddress: string) {
    const userId = req.user.sub;
    return this.userNFTService.getNFTsByCollection(userId, contractAddress);
  }

  @Post()
  @ApiOperation({ summary: "Add an NFT to user's collection" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        contractAddress: { type: "string", description: "NFT contract address" },
        tokenId: { type: "string", description: "Token ID" },
        standard: {
          type: "string",
          enum: ["ERC721", "ERC1155"],
          description: "NFT standard (optional, will be detected)",
        },
        name: { type: "string", description: "NFT name (optional, will be fetched)" },
        description: { type: "string", description: "NFT description (optional)" },
        imageUrl: { type: "string", description: "NFT image URL (optional)" },
        collectionName: { type: "string", description: "Collection name (optional)" },
        amount: { type: "number", description: "Amount for ERC1155 (default: 1)" },
      },
      required: ["contractAddress", "tokenId"],
    },
  })
  @ApiResponse({
    status: 201,
    description: "NFT added successfully",
  })
  async addUserNFT(@Request() req, @Body() nftData: CreateUserNFTDto) {
    const userId = req.user.sub;
    return this.userNFTService.addUserNFT(userId, nftData);
  }

  @Put(":nftId")
  @ApiOperation({ summary: "Update an NFT" })
  @ApiParam({ name: "nftId", description: "NFT ID" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        isActive: { type: "boolean", description: "Whether NFT is active" },
        name: { type: "string", description: "NFT name" },
        description: { type: "string", description: "NFT description" },
        imageUrl: { type: "string", description: "NFT image URL" },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: "NFT updated successfully",
  })
  async updateUserNFT(
    @Request() req,
    @Param("nftId") nftId: string,
    @Body() updateData: UpdateUserNFTDto
  ) {
    const userId = req.user.sub;
    return this.userNFTService.updateUserNFT(userId, nftId, updateData);
  }

  @Delete(":nftId")
  @ApiOperation({ summary: "Remove an NFT from user's collection (soft delete)" })
  @ApiParam({ name: "nftId", description: "NFT ID" })
  @ApiResponse({
    status: 200,
    description: "NFT removed successfully",
  })
  async removeUserNFT(@Request() req, @Param("nftId") nftId: string) {
    const userId = req.user.sub;
    await this.userNFTService.removeUserNFT(userId, nftId);
    return { message: "NFT removed successfully" };
  }

  @Delete(":nftId/permanent")
  @ApiOperation({ summary: "Permanently delete an NFT from user's collection" })
  @ApiParam({ name: "nftId", description: "NFT ID" })
  @ApiResponse({
    status: 200,
    description: "NFT deleted permanently",
  })
  async deleteUserNFT(@Request() req, @Param("nftId") nftId: string) {
    const userId = req.user.sub;
    await this.userNFTService.deleteUserNFT(userId, nftId);
    return { message: "NFT deleted permanently" };
  }

  @Get("search")
  @ApiOperation({ summary: "Search and filter user NFTs" })
  @ApiQuery({ name: "query", required: false, description: "Search query" })
  @ApiQuery({
    name: "contractAddress",
    required: false,
    description: "Filter by contract address",
  })
  @ApiQuery({
    name: "standard",
    required: false,
    enum: ["ERC721", "ERC1155"],
    description: "Filter by NFT standard",
  })
  @ApiQuery({
    name: "activeOnly",
    required: false,
    type: "boolean",
    description: "Show only active NFTs",
  })
  @ApiResponse({
    status: 200,
    description: "Filtered NFT list",
  })
  async searchUserNFTs(
    @Request() req,
    @Query("query") query?: string,
    @Query("contractAddress") contractAddress?: string,
    @Query("standard") standard?: NFTStandard,
    @Query("activeOnly") activeOnly?: boolean
  ) {
    const userId = req.user.sub;

    const filters: any = {};
    if (query) filters.query = query;
    if (contractAddress) filters.contractAddress = contractAddress;
    if (standard) filters.standard = standard;
    if (activeOnly !== undefined) filters.activeOnly = activeOnly !== false;

    return this.userNFTService.searchUserNFTs(userId, filters);
  }

  @Post("verify-ownership")
  @ApiOperation({ summary: "Verify NFT ownership" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        contractAddress: { type: "string", description: "NFT contract address" },
        tokenId: { type: "string", description: "Token ID" },
        standard: { type: "string", enum: ["ERC721", "ERC1155"], description: "NFT standard" },
      },
      required: ["contractAddress", "tokenId", "standard"],
    },
  })
  @ApiResponse({
    status: 200,
    description: "Ownership verification result",
  })
  async verifyNFTOwnership(
    @Request() req,
    @Body() body: { contractAddress: string; tokenId: string; standard: NFTStandard }
  ) {
    const userId = req.user.sub;
    const accountAddress = await this.accountService.getAccountAddress(userId);

    if (!accountAddress) {
      return { owned: false, message: "No account found for user" };
    }

    const owned = await this.userNFTService.verifyNFTOwnership(
      body.contractAddress,
      body.tokenId,
      accountAddress,
      body.standard
    );

    return { owned, accountAddress };
  }
}
