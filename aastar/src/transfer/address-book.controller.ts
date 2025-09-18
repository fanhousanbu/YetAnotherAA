import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  UseGuards,
  Request,
  Param,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AddressBookService } from "./address-book.service";

@ApiTags("address-book")
@Controller("address-book")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AddressBookController {
  constructor(private readonly addressBookService: AddressBookService) {}

  @Get()
  @ApiOperation({ summary: "Get user's address book" })
  @ApiResponse({
    status: 200,
    description: "List of frequently used addresses",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          address: { type: "string", example: "0x..." },
          name: { type: "string", example: "John's Wallet", nullable: true },
          lastUsed: { type: "string", format: "date-time" },
          usageCount: { type: "number", example: 5 },
          firstUsed: { type: "string", format: "date-time" },
          transactionHashes: { type: "array", items: { type: "string" } },
        },
      },
    },
  })
  async getAddressBook(@Request() req) {
    const userId = req.user.sub;
    return this.addressBookService.getAddressBook(userId);
  }

  @Post("name")
  @ApiOperation({ summary: "Set a name for an address" })
  @ApiResponse({
    status: 200,
    description: "Address name updated successfully",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Address name updated successfully" },
      },
    },
  })
  async setAddressName(@Request() req, @Body() body: { address: string; name: string }) {
    const userId = req.user.sub;
    await this.addressBookService.setAddressName(userId, body.address, body.name);

    return {
      success: true,
      message: "Address name updated successfully",
    };
  }

  @Delete(":address")
  @ApiOperation({ summary: "Remove an address from the address book" })
  @ApiResponse({
    status: 200,
    description: "Address removal result",
    schema: {
      type: "object",
      properties: {
        success: { type: "boolean", example: true },
        message: { type: "string", example: "Address removed successfully" },
      },
    },
  })
  async removeAddress(@Request() req, @Param("address") address: string) {
    const userId = req.user.sub;
    const removed = await this.addressBookService.removeAddress(userId, address);

    return {
      success: removed,
      message: removed ? "Address removed successfully" : "Address not found",
    };
  }

  @Get("search")
  @ApiOperation({ summary: "Search addresses in the address book" })
  @ApiResponse({
    status: 200,
    description: "Search results",
    schema: {
      type: "array",
      items: {
        type: "object",
        properties: {
          address: { type: "string", example: "0x..." },
          name: { type: "string", example: "John's Wallet", nullable: true },
          lastUsed: { type: "string", format: "date-time" },
          usageCount: { type: "number", example: 5 },
          firstUsed: { type: "string", format: "date-time" },
          transactionHashes: { type: "array", items: { type: "string" } },
        },
      },
    },
  })
  async searchAddresses(@Request() req, @Query("q") query: string) {
    const userId = req.user.sub;
    if (!query || query.length < 2) {
      return [];
    }
    return this.addressBookService.searchAddresses(userId, query);
  }
}
