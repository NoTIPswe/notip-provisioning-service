import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { CAFileStoreService } from '../src/ca/ca-file-store.service';
import { CAMaterial } from '../src/ca/model/ca-material';
import { CAUninitializedError } from '../src/ca/model/errors';

describe('CAFileStoreService', () => {
  let certsPath: string;

  const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const buildServiceWithMockedGeneration = () => {
    const service = new CAFileStoreService({
      CA_CERTS_PATH: certsPath,
    } as never);

    const fakeCa = new CAMaterial(
      '-----BEGIN PRIVATE KEY-----\nfake-ca-key\n-----END PRIVATE KEY-----',
      '-----BEGIN CERTIFICATE-----\nfake-ca-cert\n-----END CERTIFICATE-----',
    );

    (service as any).generateCA = jest.fn().mockReturnValue(fakeCa);
    (service as any).generateNATSServerCert = jest.fn().mockReturnValue({
      keyPem: '-----BEGIN PRIVATE KEY-----\nfake-nats-key\n-----END PRIVATE KEY-----',
      certPem: '-----BEGIN CERTIFICATE-----\nfake-nats-cert\n-----END CERTIFICATE-----',
    });

    return { service, fakeCa };
  };

  beforeEach(async () => {
    certsPath = await fs.mkdtemp(path.join(os.tmpdir(), 'notip-ca-'));
  });

  afterEach(async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await fs.rm(certsPath, { recursive: true, force: true });
        return;
      } catch (error) {
        if (attempt === 4) {
          throw error;
        }
        await pause(100);
      }
    }
  });

  it('returns false when CA files do not exist', async () => {
    const service = new CAFileStoreService({
      CA_CERTS_PATH: certsPath,
    } as never);
    await expect(service.caExists()).resolves.toBe(false);
  });

  it('initializes CA material and persists CA/NATS files', async () => {
    const { service, fakeCa } = buildServiceWithMockedGeneration();

    const material = await service.initialize();

    expect(material.privateKeyPem).toBe(fakeCa.privateKeyPem);
    expect(material.certificatePem).toBe(fakeCa.certificatePem);

    await expect(
      fs.access(path.join(certsPath, 'ca.key')),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(certsPath, 'ca.crt')),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(certsPath, 'nats.key')),
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(certsPath, 'nats.crt')),
    ).resolves.toBeUndefined();

    await expect(service.caExists()).resolves.toBe(true);
  });

  it('loads previously initialized CA material', async () => {
    const { service } = buildServiceWithMockedGeneration();

    const initialized = await service.initialize();
    const loaded = await service.load();

    expect(loaded.privateKeyPem).toBe(initialized.privateKeyPem);
    expect(loaded.certificatePem).toBe(initialized.certificatePem);
  });

  it('throws CAUninitializedError when loading empty files', async () => {
    await fs.writeFile(path.join(certsPath, 'ca.key'), '');
    await fs.writeFile(path.join(certsPath, 'ca.crt'), '');

    const service = new CAFileStoreService({
      CA_CERTS_PATH: certsPath,
    } as never);

    await expect(service.load()).rejects.toBeInstanceOf(CAUninitializedError);
  });

  it('writes key files with 0o600 and cert files with 0o644', async () => {
    const { service } = buildServiceWithMockedGeneration();

    await service.initialize();

    if (process.platform !== 'win32') {
      const caKeyMode =
        (await fs.stat(path.join(certsPath, 'ca.key'))).mode & 0o777;
      const natsKeyMode =
        (await fs.stat(path.join(certsPath, 'nats.key'))).mode & 0o777;
      const caCertMode =
        (await fs.stat(path.join(certsPath, 'ca.crt'))).mode & 0o777;
      const natsCertMode =
        (await fs.stat(path.join(certsPath, 'nats.crt'))).mode & 0o777;

      expect(caKeyMode).toBe(0o600);
      expect(natsKeyMode).toBe(0o600);
      expect(caCertMode).toBe(0o644);
      expect(natsCertMode).toBe(0o644);
    }
  });
});
