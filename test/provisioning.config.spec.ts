import { loadConfig } from '../src/config/provisioning.config';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('throws when required env vars are missing', () => {
    delete process.env.NATS_URL;
    delete process.env.NATS_CREDENTIALS;

    expect(() => loadConfig()).toThrow(
      'Missing required environment variable: NATS_URL',
    );
  });

  it('loads defaults and parses numbers', () => {
    process.env.NATS_URL = 'nats://localhost:4222';
    process.env.NATS_CREDENTIALS = 'token';

    const config = loadConfig();

    expect(config.NATS_URL).toBe('nats://localhost:4222');
    expect(config.NATS_CREDENTIALS).toBe('token');
    expect(config.NATS_REQUEST_TIMEOUT_MS).toBe(5000);
    expect(config.NATS_MAX_RETRIES).toBe(3);
    expect(config.CA_CERTS_PATH).toBe('/certs');
    expect(config.CERT_TTL_DAYS).toBe(90);
    expect(config.PORT).toBe(3004);
  });

  it('uses explicit env overrides', () => {
    process.env.NATS_URL = 'nats://nats:4222';
    process.env.NATS_CREDENTIALS = 'alice:secret';
    process.env.NATS_REQUEST_TIMEOUT_MS = '7000';
    process.env.NATS_MAX_RETRIES = '5';
    process.env.CA_CERTS_PATH = '/data/certs';
    process.env.CERT_TTL_DAYS = '180';
    process.env.PORT = '4010';

    const config = loadConfig();

    expect(config.NATS_REQUEST_TIMEOUT_MS).toBe(7000);
    expect(config.NATS_MAX_RETRIES).toBe(5);
    expect(config.CA_CERTS_PATH).toBe('/data/certs');
    expect(config.CERT_TTL_DAYS).toBe(180);
    expect(config.PORT).toBe(4010);
  });
});
