import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean } from "class-validator";

export class BaseResponseDto<T = any> {
  @ApiProperty({ description: "是否成功" })
  success: boolean;

  @ApiProperty({ description: "响应消息" })
  message: string;

  @ApiProperty({ description: "响应数据" })
  data?: T;

  @ApiProperty({ description: "错误代码", required: false })
  errorCode?: string;

  @ApiProperty({ description: "时间戳" })
  timestamp: string;

  constructor(success: boolean, message: string, data?: T, errorCode?: string) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.errorCode = errorCode;
    this.timestamp = new Date().toISOString();
  }

  static success<T>(data: T, message: string = "操作成功"): BaseResponseDto<T> {
    return new BaseResponseDto(true, message, data);
  }

  static error(message: string, errorCode?: string): BaseResponseDto<null> {
    return new BaseResponseDto(false, message, null, errorCode);
  }
}
