import { Module, forwardRef } from "@nestjs/common";
import { TransferService } from "./transfer.service";
import { TransferController } from "./transfer.controller";
import { AddressBookService } from "./address-book.service";
import { AddressBookController } from "./address-book.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [TransferService, AddressBookService],
  controllers: [TransferController, AddressBookController],
})
export class TransferModule {}
