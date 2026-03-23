import { Injectable } from '@nestjs/common';
import { ProvisioningCompleter } from '../provisioning/interfaces/provisioning-completer.interface';
import { NATSRRClient } from './nats-rr.client';
import { GatewayIdentity } from '../provisioning/model/gateway-identity';
import { AESKey } from '../provisioning/model/aes-key';

@Injectable()
export class NATSProvisioningCompleter implements ProvisioningCompleter {
  constructor(private readonly rrClient: NATSRRClient) {}

  async complete(identity: GatewayIdentity, aesKey: AESKey): Promise<void> {
    await this.rrClient.request(
      'internal.mgmt.provisioning.complete', //soggetto specifico
      {
        gateway_id: identity.gatewayId,
        key_material: aesKey.toBase64(),
        key_version: aesKey.version,
      },
    );
  }
}
