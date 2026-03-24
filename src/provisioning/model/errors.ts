export abstract class ProvisioningDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

//400
export class MalformedCSRError extends ProvisioningDomainError {
  constructor() {
    super('Malformed CSR PEM data');
  }
}

//401
export class InvalidFactoryCredentialsError extends ProvisioningDomainError {
  constructor() {
    super('Invalid factory credentials');
  }
}

//409
export class GatewayAlreadyProvisionedError extends ProvisioningDomainError {
  constructor() {
    super('Gateway already provisioned');
  }
}

//503
export class ManagementAPIUnavailableError extends ProvisioningDomainError {
  constructor() {
    super('Management API unavailable after retries');
  }
}
