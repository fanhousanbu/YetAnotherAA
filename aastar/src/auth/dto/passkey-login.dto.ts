import { ApiProperty } from "@nestjs/swagger";
import { IsObject } from "class-validator";

export class PasskeyLoginDto {
  @ApiProperty({ description: "WebAuthn credential response" })
  @IsObject()
  credential: any;
}

export class PasskeyLoginBeginDto {
  // 用于开始passkey登录流程，不需要任何参数
}
