import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CryptoModule } from './crypto/crypto.module';
import { ConfigModule } from './config/config.module';
import { CAModule } from './ca/ca.module';
import { NATSModule } from './nats/nats.module';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { MetricsInterceptor } from './metrics/metrics.interceptor';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    ConfigModule,
    MetricsModule,
    CryptoModule,
    CAModule,
    NATSModule,
    ProvisioningModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
