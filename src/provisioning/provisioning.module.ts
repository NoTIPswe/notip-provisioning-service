import { Module } from '@nestjs/common';
import { ProvisioningService } from './provisioning.service';
import { ProvisioningController } from './provisioning.controller';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { ProvisioningExceptionFilter } from './provisioning-exception.filter';
import { CAModule } from '../ca/ca.module';
import { NATSModule } from '../nats/nats.module';
import { CryptoModule } from '../crypto/crypto.module';

@Module({
  imports: [CAModule, NATSModule, CryptoModule],
  controllers: [ProvisioningController],
  providers: [
    ProvisioningService,
    ProvisioningExceptionFilter,
    AuditLogInterceptor,
    {
      provide: 'OnboardGateway',
      useExisting: ProvisioningService,
    },
  ],
})
export class ProvisioningModule {}
