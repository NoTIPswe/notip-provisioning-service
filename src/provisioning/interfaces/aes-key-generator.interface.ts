import { AESKey } from '../model/aes-key';

export interface AESKeyGenerator {
  generate(): AESKey;
}
