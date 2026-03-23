import { Injectable } from '@nestjs/common';
import { FactoryValidator } from '../provisioning/interfaces/factory-validator.interface';
import { NATSRRClient } from './nats-rr.client';
import { FactoryCredentials } from '../provisioning/model/factory-credentials';
import { GatewayIdentity } from '../provisioning/model/gateway-identity';
import {
  InvalidFactoryCredentialsError,
  GatewayAlreadyProvisionedError,
} from '../provisioning/model/errors';

@Injectable()
export class NATSFactoryValidator implements FactoryValidator {
  constructor(private readonly rrClient: NATSRRClient) {}

  async validate(credentials: FactoryCredentials): Promise<GatewayIdentity> {
    const response = (await this.rrClient.request<any>(
      'internal.mgmt.factory.validate', //soggetto specifico
      {
        factory_id: credentials.factoryId,
        factory_key: credentials.factoryKey,
      },
    )) as Record<string, any>;

    //mappatura delle risposte del Management API

    if (response.error === 'INVALID')
      throw new InvalidFactoryCredentialsError();

    if (response.error === 'ALREADY_PROVISIONED')
      throw new GatewayAlreadyProvisionedError();

    return new GatewayIdentity(
      response.gateway_id as string,
      response.tenant_id as string,
    );
  }
}
