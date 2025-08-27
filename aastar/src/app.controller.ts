import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AppService } from "./app.service";

@ApiTags("health")
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get("health")
  @ApiOperation({ summary: "Health check endpoint" })
  getHealth() {
    return this.appService.getHealth();
  }

  @Get("info")
  @ApiOperation({ summary: "Get API information" })
  getInfo() {
    return this.appService.getInfo();
  }
}
