import { Injectable } from '@nestjs/common';
import { FactoryValidator } from '../provisioning/interfaces/factory-validator.interface';
import { NATSRRClient } from './nats-rr.client';
import { FactoryCredentials } from '../provisioning/model/factory-credentials';
import { GatewayIdentity } from '../provisioning/model/gateway-identity';
import {
  InvalidFactoryCredentialsError,
  GatewayAlreadyProvisionedError,
  ManagementAPIUnavailableError,
} from '../provisioning/model/errors';

@Injectable()
export class NATSFactoryValidator implements FactoryValidator {
  constructor(private readonly rrClient: NATSRRClient) {}

  async validate(credentials: FactoryCredentials): Promise<GatewayIdentity> {
    const response = await this.rrClient.request<unknown>(
      'internal.mgmt.factory.validate',
      {
        factory_id: credentials.factoryId,
        factory_key: credentials.factoryKey,
      },
    );

    if (!this.isRecord(response)) {
      throw new ManagementAPIUnavailableError();
    }

    if (response.error === 'INVALID') {
      throw new InvalidFactoryCredentialsError();
    }

    if (response.error === 'ALREADY_PROVISIONED') {
      throw new GatewayAlreadyProvisionedError();
    }

    if (
      typeof response.gateway_id !== 'string' ||
      typeof response.tenant_id !== 'string'
    ) {
      throw new ManagementAPIUnavailableError();
    }

    return new GatewayIdentity(response.gateway_id, response.tenant_id);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
