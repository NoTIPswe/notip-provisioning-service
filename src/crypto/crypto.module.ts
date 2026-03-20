import { Module } from '@nestjs/common';
import { AESKeyGeneratorService } from './aes-key-generator.service';

@Module({
  providers: [
    {
      // Usiamo una stringa come token per l'interfaccia
      provide: 'AESKeyGenerator',
      useClass: AESKeyGeneratorService,
    },
  ],
  // Esportiamo il token in modo che il ProvisioningService possa iniettarlo

  exports: ['AESKeyGenerator'],
})
export class CryptoModule {}
