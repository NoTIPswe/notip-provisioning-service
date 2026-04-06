import { Global, Module } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';
import { ProvisioningMetrics } from './provisioning.metrics';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [ProvisioningMetrics, MetricsService, MetricsInterceptor],
  exports: [ProvisioningMetrics, MetricsService, MetricsInterceptor],
})
export class MetricsModule {}
