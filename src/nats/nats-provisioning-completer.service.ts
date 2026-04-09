import { Injectable } from '@nestjs/common';
import { ProvisioningCompleter } from '../provisioning/interfaces/provisioning-completer.interface';
import { NATSRRClient } from './nats-rr.client';
import { GatewayIdentity } from '../provisioning/model/gateway-identity';
import { AESKey } from '../provisioning/model/aes-key';
import { ManagementAPIUnavailableError } from '../provisioning/model/errors';

@Injectable()
export class NATSProvisioningCompleter implements ProvisioningCompleter {
  constructor(private readonly rrClient: NATSRRClient) {}

  async complete(
    identity: GatewayIdentity,
    aeskey: AESKey,
    sendFrequencyMs: number,
    firmwareVersion: string,
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      gateway_id: identity.gatewayId,
      key_material: aeskey.toBase64(),
      key_version: aeskey.version,
      send_frequency_ms: sendFrequencyMs,
    };
    if (firmwareVersion.trim() !== '') {
      payload.firmware_version = firmwareVersion;
    }

    const response = await this.rrClient.request<unknown>(
      'internal.mgmt.provisioning.complete',
      payload,
    );

    if (!this.isRecord(response) || response.success !== true) {
      throw new ManagementAPIUnavailableError();
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
