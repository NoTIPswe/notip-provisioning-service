import { Global, Module } from '@nestjs/common';
import { ProvisioningMetrics } from './provisioning.metrics';

@Global()
@Module({
  providers: [ProvisioningMetrics],
  exports: [ProvisioningMetrics],
})
export class MetricsModule {}
