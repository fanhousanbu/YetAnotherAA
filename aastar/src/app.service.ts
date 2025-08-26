import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  getHello(): string {
    return "🌟 欢迎使用 AAstar ERC-4337 服务! 请访问 /api 查看API文档";
  }

  getHealth() {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      service: "AAstar ERC-4337 API",
      version: "1.0.0",
      features: [
        "账户抽象 (ERC-4337)",
        "BLS聚合签名验证",
        "Enhanced Account支持",
        "Bundler集成",
        "Swagger文档",
      ],
    };
  }
}
