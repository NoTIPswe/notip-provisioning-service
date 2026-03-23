import { GatewayIdentity } from '../model/gateway-identity';
import { AESKey } from '../model/aes-key';

export interface ProvisioningCompleter {
  complete(identity: GatewayIdentity, aeskey: AESKey): Promise<void>;
}
