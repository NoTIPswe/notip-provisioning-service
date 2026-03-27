import { FactoryCredentials } from '../model/factory-credentials';
import { GatewayIdentity } from '../model/gateway-identity';

export interface FactoryValidator {
  validate(credentials: FactoryCredentials): Promise<GatewayIdentity>;
}
