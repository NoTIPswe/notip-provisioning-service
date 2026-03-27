import { Module, Global } from '@nestjs/common';
import { loadConfig } from './provisioning.config';

@Global()
@Module({
  providers: [
    {
      provide: 'CONFIG',
      useValue: loadConfig(),
    },
  ],
  exports: ['CONFIG'],
})
export class ConfigModule {}
