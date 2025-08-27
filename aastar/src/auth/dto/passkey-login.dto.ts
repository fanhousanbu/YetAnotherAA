import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PasskeyLoginDto {
  @ApiProperty()
  credential: any;
}

export class PasskeyLoginBeginDto {
  // 用于开始passkey登录流程，不需要任何参数
}