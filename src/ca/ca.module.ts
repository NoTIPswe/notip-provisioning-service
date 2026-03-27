import { Module } from '@nestjs/common';
import { CAFileStoreService } from './ca-file-store.service';
import { ForgeCSRSignerService } from './forge-csr-signer.service';
import { CAInitializerService } from './ca-initializer.service';

@Module({
  providers: [
    {
      provide: 'CARepository',
      useClass: CAFileStoreService,
    },
    ForgeCSRSignerService,
    CAInitializerService,
    {
      provide: 'CAProvider',
      useExisting: CAInitializerService,
    },
    {
      provide: 'CSRSigner',
      useExisting: ForgeCSRSignerService,
    },
  ],
  exports: ['CAProvider', 'CSRSigner'],
})
export class CAModule {}
