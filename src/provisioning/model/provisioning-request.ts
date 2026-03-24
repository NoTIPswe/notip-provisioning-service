import { FactoryCredentials } from './factory-credentials';
import { GatewayCSR } from './gateway-csr';

export class ProvisioningRequest {
  constructor(
    public readonly credentials: FactoryCredentials,
    public readonly csr: GatewayCSR,
  ) {}
}
