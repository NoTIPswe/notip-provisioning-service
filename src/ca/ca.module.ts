import { Module } from '@nestjs/common';
import { CAFileStoreService } from './ca-file-store.service';
import { ForgeCSRSignerService } from './forge-csr-signer.service';
import { CAInitializerService } from './ca-initializer.service';

@Module({
  providers: [
    {
      provide: 'CARepository', //firma
      useClass: CAFileStoreService, //implementazione
    },
    ForgeCSRSignerService,
    CAInitializerService, //si avvia all'avvio
  ],
  //esportiamo solo quello che serve agli altri
  exports: ['CARepository', ForgeCSRSignerService],
})
export class CAModule {}
