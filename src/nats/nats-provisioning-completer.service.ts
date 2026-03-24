import { Injectable } from '@nestjs/common';
import { ProvisioningCompleter } from '../provisioning/interfaces/provisioning-completer.interface';
import { NATSRRClient } from './nats-rr.client';
import { GatewayIdentity } from '../provisioning/model/gateway-identity';
import { AESKey } from '../provisioning/model/aes-key';
import { ManagementAPIUnavailableError } from '../provisioning/model/errors';

@Injectable()
export class NATSProvisioningCompleter implements ProvisioningCompleter {
  constructor(private readonly rrClient: NATSRRClient) {}

  async complete(identity: GatewayIdentity, aesKey: AESKey): Promise<void> {
    const response = await this.rrClient.request<unknown>(
      'internal.mgmt.provisioning.complete',
      {
        gateway_id: identity.gatewayId,
        key_material: aesKey.toBase64(),
        key_version: aesKey.version,
      },
    );

    if (!this.isRecord(response) || response.success !== true) {
      throw new ManagementAPIUnavailableError();
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
