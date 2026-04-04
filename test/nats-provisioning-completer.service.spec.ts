import { NATSProvisioningCompleter } from '../src/nats/nats-provisioning-completer.service';
import { GatewayIdentity } from '../src/provisioning/model/gateway-identity';
import { AESKey } from '../src/provisioning/model/aes-key';
import { ManagementAPIUnavailableError } from '../src/provisioning/model/errors';

describe('NATSProvisioningCompleter', () => {
  const identity = new GatewayIdentity('gw-1', 'tenant-1');
  const aeskey = new AESKey(Buffer.alloc(32, 9), 1);
  const sendFrequencyMs = 5000;
  const firmwareVersion = '1.2.3';

  it('sends completion payload and resolves on success=true', async () => {
    const rrClient = {
      request: jest.fn().mockResolvedValue({ success: true }),
    };

    const service = new NATSProvisioningCompleter(rrClient as never);

    await expect(
      service.complete(identity, aeskey, sendFrequencyMs, firmwareVersion),
    ).resolves.toBeUndefined();
    expect(rrClient.request).toHaveBeenCalledWith(
      'internal.mgmt.provisioning.complete',
      {
        gateway_id: 'gw-1',
        key_material: aeskey.toBase64(),
        key_version: 1,
        send_frequency_ms: sendFrequencyMs,
        firmware_version: firmwareVersion,
      },
    );
  });

  it('throws ManagementAPIUnavailableError for non-success response', async () => {
    const rrClient = {
      request: jest.fn().mockResolvedValue({ success: false }),
    };

    const service = new NATSProvisioningCompleter(rrClient as never);

    await expect(
      service.complete(identity, aeskey, sendFrequencyMs, firmwareVersion),
    ).rejects.toBeInstanceOf(ManagementAPIUnavailableError);
  });

  it('omits firmware_version when empty', async () => {
    const rrClient = {
      request: jest.fn().mockResolvedValue({ success: true }),
    };

    const service = new NATSProvisioningCompleter(rrClient as never);

    await expect(
      service.complete(identity, aeskey, sendFrequencyMs, ''),
    ).resolves.toBeUndefined();

    expect(rrClient.request).toHaveBeenCalledWith(
      'internal.mgmt.provisioning.complete',
      {
        gateway_id: 'gw-1',
        key_material: aeskey.toBase64(),
        key_version: 1,
        send_frequency_ms: sendFrequencyMs,
      },
    );
  });
});
