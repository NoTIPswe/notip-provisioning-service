import { NATSServerCertificate } from '../src/ca/model/nats-server-certificate';
import { OnboardResponseDto } from '../src/provisioning/dto/onboard-response.dto';

describe('Module smoke tests', () => {
  it('loads Nest modules', () => {
    process.env.NATS_URL = 'nats://localhost:4222';
    process.env.NATS_CREDENTIALS = 'token';

    jest.resetModules();
    const appModule =
      jest.requireActual<typeof import('../src/app.module')>(
        '../src/app.module',
      );
    const caModule = jest.requireActual<typeof import('../src/ca/ca.module')>(
      '../src/ca/ca.module',
    );
    const configModule = jest.requireActual<
      typeof import('../src/config/config.module')
    >('../src/config/config.module');
    const cryptoModule = jest.requireActual<
      typeof import('../src/crypto/crypto.module')
    >('../src/crypto/crypto.module');
    const metricsModule = jest.requireActual<
      typeof import('../src/metrics/metrics.module')
    >('../src/metrics/metrics.module');
    const natsModule = jest.requireActual<
      typeof import('../src/nats/nats.module')
    >('../src/nats/nats.module');
    const provisioningModule = jest.requireActual<
      typeof import('../src/provisioning/provisioning.module')
    >('../src/provisioning/provisioning.module');

    expect(appModule.AppModule).toBeDefined();
    expect(caModule.CAModule).toBeDefined();
    expect(configModule.ConfigModule).toBeDefined();
    expect(cryptoModule.CryptoModule).toBeDefined();
    expect(metricsModule.MetricsModule).toBeDefined();
    expect(natsModule.NATSModule).toBeDefined();
    expect(provisioningModule.ProvisioningModule).toBeDefined();
  });

  it('instantiates low-level DTO/model classes', () => {
    const cert = new NATSServerCertificate('key', 'cert');
    const dto = new OnboardResponseDto();
    dto.certPem = 'pem';
    dto.aesKey = 'base64';

    expect(cert.keyPem).toBe('key');
    expect(cert.certPem).toBe('cert');
    expect(dto.certPem).toBe('pem');
    expect(dto.aesKey).toBe('base64');
  });
});
