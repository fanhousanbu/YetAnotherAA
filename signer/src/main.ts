import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.enableCors();

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('BLS Signer Service API')
    .setDescription('API documentation for ERC4337 BLS signature aggregation service')
    .setVersion('1.0')
    .addTag('signature', 'Signature operations')
    .addTag('node', 'Node management')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  
  const port = process.env.PORT || 3000;
  
  await app.listen(port);
  
  console.log(`🚀 BLS Signer Service is running on port ${port}`);
  console.log(`📖 Swagger API documentation: http://localhost:${port}/api`);
  console.log(`📋 Available endpoints:`);
  console.log(`   GET /node/info - Get current node information`);
  console.log(`   POST /node/register - Register node on-chain`);
  console.log(`   POST /signature/sign - Sign message with this node`);
  console.log(`   POST /signature/aggregate - Sign and return as aggregate format`);
}

bootstrap();