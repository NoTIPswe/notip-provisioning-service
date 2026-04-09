jest.mock('node-forge', () => {
  const caCertificate = {
    subject: {
      attributes: [{ name: 'commonName', value: 'NoTIP Internal CA' }],
    },
  };

  const natsCertificate = {
    subject: {
      attributes: [{ name: 'commonName', value: 'NoTIP Internal CA' }],
    },
  };

  const certificateFactory = jest
    .fn()
    .mockImplementationOnce(() => ({
      publicKey: null,
      serialNumber: '',
      validity: { notBefore: new Date(), notAfter: new Date() },
      setSubject: jest.fn(),
      setIssuer: jest.fn(),
      setExtensions: jest.fn(),
      sign: jest.fn(),
    }))
    .mockImplementationOnce(() => ({
      publicKey: null,
      serialNumber: '',
      validity: { notBefore: new Date(), notAfter: new Date() },
      setSubject: jest.fn(),
      setIssuer: jest.fn(),
      setExtensions: jest.fn(),
      sign: jest.fn(),
    }));

  const keyPairFactory = jest
    .fn()
    .mockImplementationOnce(() => ({
      privateKey: { kind: 'ca-private' },
      publicKey: { kind: 'ca-public' },
    }))
    .mockImplementationOnce(() => ({
      privateKey: { kind: 'nats-private' },
      publicKey: { kind: 'nats-public' },
    }));

  return {
    pki: {
      rsa: {
        generateKeyPair: keyPairFactory,
      },
      createCertificate: certificateFactory,
      privateKeyToPem: jest
        .fn()
        .mockImplementationOnce(() => 'CA_PRIVATE_PEM')
        .mockImplementationOnce(() => 'NATS_PRIVATE_PEM'),
      certificateToPem: jest
        .fn()
        .mockImplementationOnce(() => 'CA_CERT_PEM')
        .mockImplementationOnce(() => 'NATS_CERT_PEM'),
      privateKeyFromPem: jest.fn(() => ({ kind: 'ca-private' })),
      certificateFromPem: jest.fn(() => caCertificate),
    },
    md: {
      sha256: {
        create: jest.fn(() => ({})),
      },
    },
    random: {
      getBytesSync: jest.fn(() => '\u0001'.repeat(16)),
    },
    util: {
      bytesToHex: jest.fn(() => '1234567890abcdef1234567890abcdef'),
    },
  };
});

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { CAFileStoreService } from '../src/ca/ca-file-store.service';

describe('CAFileStoreService generation path', () => {
  let certsPath: string;

  beforeEach(async () => {
    certsPath = await fs.mkdtemp(path.join(os.tmpdir(), 'notip-ca-gen-'));
  });

  afterEach(async () => {
    await fs.rm(certsPath, { recursive: true, force: true });
  });

  it('generates and persists CA and NATS certificates', async () => {
    const service = new CAFileStoreService({
      CA_CERTS_PATH: certsPath,
    } as never);

    const material = await service.initialize();

    expect(material.privateKeyPem).toBe('CA_PRIVATE_PEM');
    expect(material.certificatePem).toBe('CA_CERT_PEM');

    await expect(fs.readFile(path.join(certsPath, 'ca.key'), 'utf8')).resolves.toBe(
      'CA_PRIVATE_PEM',
    );
    await expect(fs.readFile(path.join(certsPath, 'ca.crt'), 'utf8')).resolves.toBe(
      'CA_CERT_PEM',
    );
    await expect(fs.readFile(path.join(certsPath, 'nats.key'), 'utf8')).resolves.toBe(
      'NATS_PRIVATE_PEM',
    );
    await expect(fs.readFile(path.join(certsPath, 'nats.crt'), 'utf8')).resolves.toBe(
      'NATS_CERT_PEM',
    );
  });
});