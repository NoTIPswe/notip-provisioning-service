import { Module } from '@nestjs/common';
import { NATSRRClient } from './nats-rr.client';
import { NATSFactoryValidator } from './nats-factory-validator.service';
import { NATSProvisioningCompleter } from './nats-provisioning-completer.service';

@Module({
  providers: [
    NATSRRClient,
    {
      provide: 'FactoryValidator',
      useClass: NATSFactoryValidator,
    },
    {
      provide: 'ProvisioningCompleter',
      useClass: NATSProvisioningCompleter,
    },
  ],
  exports: ['FactoryValidator', 'ProvisioningCompleter'],
})
export class NATSModule {}
