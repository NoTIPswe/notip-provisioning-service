import { Test } from '@nestjs/testing';
import { ProvisioningService } from '../src/provisioning/provisioning.service';
import { NATSFactoryValidator } from '../src/nats/nats-factory-validator.service';
import { NATSProvisioningCompleter } from '../src/nats/nats-provisioning-completer.service';
import { NATSRRClient } from '../src/nats/nats-rr.client';
import { AESKeyGeneratorService } from '../src/crypto/aes-key-generator.service';
import { ProvisioningMetrics } from '../src/metrics/provisioning.metrics';
import { FactoryCredentials } from '../src/provisioning/model/factory-credentials';
import { GatewayCSR } from '../src/provisioning/model/gateway-csr';
import { ProvisioningRequest } from '../src/provisioning/model/provisioning-request';
import { SignedCertificate } from '../src/ca/model/signed-certificate';

describe('Onboard flow integration', () => {
  it('integrates service + NATS adapters + AES generator with DI wiring', async () => {
    const rrClient = {
      request: jest
        .fn()
        .mockResolvedValueOnce({ gateway_id: 'gw-1', tenant_id: 'tenant-1' })
        .mockResolvedValueOnce({ success: true }),
    };

    const csrSigner = {
      sign: jest.fn().mockResolvedValue(new SignedCertificate('CERT_PEM')),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProvisioningService,
        NATSFactoryValidator,
        NATSProvisioningCompleter,
        AESKeyGeneratorService,
        ProvisioningMetrics,
        {
          provide: NATSRRClient,
          useValue: rrClient,
        },
        {
          provide: 'FactoryValidator',
          useExisting: NATSFactoryValidator,
        },
        {
          provide: 'ProvisioningCompleter',
          useExisting: NATSProvisioningCompleter,
        },
        {
          provide: 'AESKeyGenerator',
          useExisting: AESKeyGeneratorService,
        },
        {
          provide: 'CSRSigner',
          useValue: csrSigner,
        },
      ],
    }).compile();

    const service = moduleRef.get(ProvisioningService);

    const request = new ProvisioningRequest(
      new FactoryCredentials('factory-1', 'factory-key-1'),
      new GatewayCSR('-----BEGIN CERTIFICATE REQUEST-----\nabc'),
    );

    const result = await service.onboard(request);

    expect(rrClient.request).toHaveBeenNthCalledWith(
      1,
      'internal.mgmt.factory.validate',
      {
        factory_id: 'factory-1',
        factory_key: 'factory-key-1',
      },
    );

    expect(csrSigner.sign).toHaveBeenCalledWith(
      request.csr,
      expect.objectContaining({ gatewayId: 'gw-1', tenantId: 'tenant-1' }),
    );

    expect(rrClient.request).toHaveBeenNthCalledWith(
      2,
      'internal.mgmt.provisioning.complete',
      expect.objectContaining({
        gateway_id: 'gw-1',
        key_version: 1,
      }),
    );

    expect(result.certificate.pemData).toBe('CERT_PEM');
    expect(result.identity.gatewayId).toBe('gw-1');
    expect(typeof result.aeskey.toBase64()).toBe('string');
  });
});
