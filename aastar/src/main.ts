import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    })
  );

  // CORS配置
  app.enableCors({
    origin: ["http://localhost:3000", "http://localhost:8080", "http://localhost:3001"],
    credentials: true,
  });

  // Swagger文档配置
  const config = new DocumentBuilder()
    .setTitle("AAstar ERC-4337 API")
    .setDescription("AAstar账户抽象和聚合签名转账服务")
    .setVersion("1.0")
    .addTag("accounts", "账户管理")
    .addTag("transfer", "转账服务")
    .addTag("signature", "签名服务")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log("🚀 AAstar服务已启动!");
  console.log(`📖 API文档地址: http://localhost:${port}/api`);
  console.log(`🔗 服务地址: http://localhost:${port}`);
}

bootstrap();
