import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ProvisioningController } from '../src/provisioning/provisioning.controller';
import { ProvisioningService } from '../src/provisioning/provisioning.service';
import { ProvisioningMetrics } from '../src/metrics/provisioning.metrics';
import { NATSFactoryValidator } from '../src/nats/nats-factory-validator.service';
import { NATSProvisioningCompleter } from '../src/nats/nats-provisioning-completer.service';
import { NATSRRClient } from '../src/nats/nats-rr.client';
import { AESKeyGeneratorService } from '../src/crypto/aes-key-generator.service';
import { AuditLogInterceptor } from '../src/provisioning/audit-log.interceptor';
import { ProvisioningExceptionFilter } from '../src/provisioning/provisioning-exception.filter';
import { SignedCertificate } from '../src/ca/model/signed-certificate';
import { register } from 'prom-client';

type OnboardHttpResponse = {
  certPem?: unknown;
  aesKey?: unknown;
  identity?: {
    gatewayId?: unknown;
    tenantId?: unknown;
  };
  sendFrequencyMs?: unknown;
};

describe('Provisioning onboard (e2e)', () => {
  let app: INestApplication;
  const rrClient = {
    request: jest.fn(),
  };
  const csrSigner = {
    sign: jest.fn().mockResolvedValue(new SignedCertificate('CERT_PEM')),
  };

  beforeEach(async () => {
    register.clear();
    rrClient.request.mockReset();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ProvisioningController],
      providers: [
        ProvisioningService,
        ProvisioningMetrics,
        NATSFactoryValidator,
        NATSProvisioningCompleter,
        AESKeyGeneratorService,
        AuditLogInterceptor,
        ProvisioningExceptionFilter,
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
        {
          provide: 'OnboardGateway',
          useExisting: ProvisioningService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 201 with certPem, aesKey and identity on successful onboarding', () => {
    rrClient.request
      .mockResolvedValueOnce({ gateway_id: 'gw-1', tenant_id: 'tenant-1' })
      .mockResolvedValueOnce({ success: true });

    const httpServer = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];

    return request(httpServer)
      .post('/provision/onboard')
      .send({
        credentials: {
          factoryId: 'factory-1',
          factoryKey: 'factory-key-1',
        },
        csr: '-----BEGIN CERTIFICATE REQUEST-----\\nabc',
        sendFrequencyMs: 5000,
        firmwareVersion: '1.0.0',
      })
      .expect(201)
      .expect((res) => {
        const body = res.body as OnboardHttpResponse;
        expect(body.certPem).toBe('CERT_PEM');
        expect(typeof body.aesKey).toBe('string');
        expect(body.identity).toEqual({
          gatewayId: 'gw-1',
          tenantId: 'tenant-1',
        });
        expect(body.sendFrequencyMs).toBe(5000);
      });
  });

  it('returns 401 when factory credentials are invalid', () => {
    rrClient.request.mockResolvedValueOnce({ error: 'INVALID' });

    const httpServer = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];

    return request(httpServer)
      .post('/provision/onboard')
      .send({
        credentials: {
          factoryId: 'factory-1',
          factoryKey: 'wrong-key',
        },
        csr: '-----BEGIN CERTIFICATE REQUEST-----\\nabc',
        sendFrequencyMs: 5000,
        firmwareVersion: '1.0.0',
      })
      .expect(401)
      .expect({ error: 'INVALID_CREDENTIALS' });
  });

  it('returns 400 for malformed CSR', () => {
    const httpServer = app.getHttpServer() as unknown as Parameters<
      typeof request
    >[0];

    return request(httpServer)
      .post('/provision/onboard')
      .send({
        credentials: {
          factoryId: 'factory-1',
          factoryKey: 'factory-key-1',
        },
        csr: 'invalid-csr',
        sendFrequencyMs: 5000,
        firmwareVersion: '1.0.0',
      })
      .expect(400)
      .expect({ error: 'MALFORMED_CSR' });
  });
});
