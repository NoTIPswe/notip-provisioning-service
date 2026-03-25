import { NATSProvisioningCompleter } from '../src/nats/nats-provisioning-completer.service';
import { GatewayIdentity } from '../src/provisioning/model/gateway-identity';
import { AESKey } from '../src/provisioning/model/aes-key';
import { ManagementAPIUnavailableError } from '../src/provisioning/model/errors';

describe('NATSProvisioningCompleter', () => {
  const identity = new GatewayIdentity('gw-1', 'tenant-1');
  const aesKey = new AESKey(Buffer.alloc(32, 9), 1);

  it('sends completion payload and resolves on success=true', async () => {
    const rrClient = {
      request: jest.fn().mockResolvedValue({ success: true }),
    };

    const service = new NATSProvisioningCompleter(rrClient as never);

    await expect(service.complete(identity, aesKey)).resolves.toBeUndefined();
    expect(rrClient.request).toHaveBeenCalledWith(
      'internal.mgmt.provisioning.complete',
      {
        gateway_id: 'gw-1',
        key_material: aesKey.toBase64(),
        key_version: 1,
      },
    );
  });

  it('throws ManagementAPIUnavailableError for non-success response', async () => {
    const rrClient = {
      request: jest.fn().mockResolvedValue({ success: false }),
    };

    const service = new NATSProvisioningCompleter(rrClient as never);

    await expect(service.complete(identity, aesKey)).rejects.toBeInstanceOf(
      ManagementAPIUnavailableError,
    );
  });
});
