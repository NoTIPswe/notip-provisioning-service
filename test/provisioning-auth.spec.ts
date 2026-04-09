import { INestApplication, HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { register } from 'prom-client';
import { ProvisioningController } from '../src/provisioning/provisioning.controller';
import { ProvisioningService } from '../src/provisioning/provisioning.service';
import { ProvisioningMetrics } from '../src/metrics/provisioning.metrics';
import { NATSFactoryValidator } from '../src/nats/nats-factory-validator.service';
import { NATSProvisioningCompleter } from '../src/nats/nats-provisioning-completer.service';
import { NATSRRClient } from '../src/nats/nats-rr.client';
import { AESKeyGeneratorService } from '../src/crypto/aes-key-generator.service';
import { AuditLogInterceptor } from '../src/provisioning/audit-log.interceptor';
import { ProvisioningExceptionFilter } from '../src/provisioning/provisioning-exception.filter';
import { InvalidFactoryCredentialsError } from '../src/provisioning/model/errors';
import { SignedCertificate } from '../src/ca/model/signed-certificate';

describe('Provisioning auth coverage', () => {
  it('maps invalid factory credentials to 401', () => {
    const filter = new ProvisioningExceptionFilter();
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as never;

    filter.catch(new InvalidFactoryCredentialsError(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({ error: 'INVALID_CREDENTIALS' });
  });

  describe('e2e onboarding auth flow', () => {
    let app: INestApplication;
    const rrClient = {
      request: jest.fn(),
      publish: jest.fn().mockResolvedValue(undefined),
    };
    const csrSigner = {
      sign: jest.fn().mockResolvedValue(new SignedCertificate('CERT_PEM')),
    };

    beforeEach(async () => {
      register.clear();
      rrClient.request.mockReset();
      rrClient.publish.mockReset();
      rrClient.publish.mockResolvedValue(undefined);

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
      await app.init();
    });

    afterEach(async () => {
      await app.close();
    });

    it('returns 401 for invalid factory credentials', () => {
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
          csr: '-----BEGIN CERTIFICATE REQUEST-----\nabc',
          sendFrequencyMs: 5000,
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
        })
        .expect(400)
        .expect({ error: 'MALFORMED_CSR' });
    });
  });
});
