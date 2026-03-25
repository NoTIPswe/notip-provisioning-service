import { NATSFactoryValidator } from '../src/nats/nats-factory-validator.service';
import { FactoryCredentials } from '../src/provisioning/model/factory-credentials';
import {
  GatewayAlreadyProvisionedError,
  InvalidFactoryCredentialsError,
  ManagementAPIUnavailableError,
} from '../src/provisioning/model/errors';

describe('NATSFactoryValidator', () => {
  const credentials = new FactoryCredentials('factory-1', 'factory-key-1');

  it('returns GatewayIdentity for valid response payload', async () => {
    const rrClient = {
      request: jest
        .fn()
        .mockResolvedValue({ gateway_id: 'gw-1', tenant_id: 'tenant-1' }),
    };

    const service = new NATSFactoryValidator(rrClient as never);
    const identity = await service.validate(credentials);

    expect(rrClient.request).toHaveBeenCalledWith(
      'internal.mgmt.factory.validate',
      {
        factory_id: 'factory-1',
        factory_key: 'factory-key-1',
      },
    );
    expect(identity.gatewayId).toBe('gw-1');
    expect(identity.tenantId).toBe('tenant-1');
  });

  it('maps INVALID response error', async () => {
    const rrClient = {
      request: jest.fn().mockResolvedValue({ error: 'INVALID' }),
    };

    const service = new NATSFactoryValidator(rrClient as never);

    await expect(service.validate(credentials)).rejects.toBeInstanceOf(
      InvalidFactoryCredentialsError,
    );
  });

  it('maps ALREADY_PROVISIONED response error', async () => {
    const rrClient = {
      request: jest.fn().mockResolvedValue({ error: 'ALREADY_PROVISIONED' }),
    };

    const service = new NATSFactoryValidator(rrClient as never);

    await expect(service.validate(credentials)).rejects.toBeInstanceOf(
      GatewayAlreadyProvisionedError,
    );
  });

  it('throws ManagementAPIUnavailableError on invalid payload', async () => {
    const rrClient = {
      request: jest.fn().mockResolvedValue({ ok: true }),
    };

    const service = new NATSFactoryValidator(rrClient as never);

    await expect(service.validate(credentials)).rejects.toBeInstanceOf(
      ManagementAPIUnavailableError,
    );
  });
});
