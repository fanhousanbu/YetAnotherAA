import { Module } from "@nestjs/common";
import { TransferService } from "./transfer.service";
import { TransferController } from "./transfer.controller";
import { AddressBookService } from "./address-book.service";
import { AddressBookController } from "./address-book.controller";

@Module({
  providers: [TransferService, AddressBookService],
  controllers: [TransferController, AddressBookController],
})
export class TransferModule {}
