import { Module } from "@nestjs/common";
import { DataToolsController } from "./data-tools.controller";
import { DataToolsService } from "./data-tools.service";

@Module({
  controllers: [DataToolsController],
  providers: [DataToolsService],
  exports: [DataToolsService],
})
export class DataToolsModule {}
