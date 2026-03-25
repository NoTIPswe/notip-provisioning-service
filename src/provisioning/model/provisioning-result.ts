import { SignedCertificate } from '../../ca/model/signed-certificate';
import { AESKey } from './aes-key';
import { GatewayIdentity } from './gateway-identity';

export class ProvisioningResult {
  constructor(
    public readonly certificate: SignedCertificate,
    public readonly aeskey: AESKey,
    public readonly identity: GatewayIdentity,
  ) {}
}
