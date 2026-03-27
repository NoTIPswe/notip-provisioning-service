import { Injectable } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { AESKey } from '../provisioning/model/aes-key';
import { AESKeyGenerator } from '../provisioning/interfaces/aes-key-generator.interface';

@Injectable()
export class AESKeyGeneratorService implements AESKeyGenerator {
  generate(): AESKey {
    // Genera 32 byte di dati casuali utilizzando il CSPRNG dell'OS
    const buffer = crypto.randomBytes(32);

    // Ritorna un nuovo oggetto AESKey con versione 1
    return new AESKey(buffer, 1);
  }
}
