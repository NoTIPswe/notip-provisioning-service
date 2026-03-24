import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import type { ProvisioningConfig } from './config/provisioning.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  const config = app.get<ProvisioningConfig>('CONFIG');
  await app.listen(config.PORT ?? 3004);
}
bootstrap().catch(console.error);
