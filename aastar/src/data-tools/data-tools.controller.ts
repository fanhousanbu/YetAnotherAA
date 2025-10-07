import { Controller, Post, Body, Res, HttpException, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Response } from "express";
import { DataToolsService } from "./data-tools.service";
import { ExportDataDto, ImportDataDto } from "./dto/data-tools.dto";

@ApiTags("data-tools")
@Controller("data-tools")
export class DataToolsController {
  constructor(private dataToolsService: DataToolsService) {}

  @Post("export")
  @ApiOperation({ summary: "Export all persistent data" })
  async exportData(@Body() exportDto: ExportDataDto, @Res() res: Response) {
    try {
      const result = await this.dataToolsService.exportData(exportDto.password);

      res.setHeader("Content-Type", "application/gzip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="aastar-data-${Date.now()}.tar.gz"`
      );

      return res.send(result);
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post("import")
  @ApiOperation({ summary: "Import persistent data" })
  async importData(@Body() importDto: ImportDataDto) {
    try {
      await this.dataToolsService.importData(importDto.password, importDto.data);
      return { message: "Data imported successfully" };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
