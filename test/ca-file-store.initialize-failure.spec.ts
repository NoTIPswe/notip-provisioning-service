jest.mock('node:fs/promises', () => {
  const actual = jest.requireActual<typeof import('node:fs/promises')>(
    'node:fs/promises',
  );

  return {
    ...actual,
    writeFile: jest.fn().mockRejectedValue(new Error('write failed')),
  };
});

import * as fs from 'node:fs/promises';
import { CAFileStoreService } from '../src/ca/ca-file-store.service';
import { CAMaterial } from '../src/ca/model/ca-material';
import { CAUninitializedError } from '../src/ca/model/errors';

describe('CAFileStoreService initialize failures', () => {
  it('wraps write failures in CAUninitializedError', async () => {
    const service = new CAFileStoreService({
      CA_CERTS_PATH: '/tmp/notip-ca-failure',
    } as never);

    jest.spyOn(service as never, 'generateCA').mockReturnValue(
      new CAMaterial('CA_PRIVATE_PEM', 'CA_CERT_PEM'),
    );
    jest.spyOn(service as never, 'generateNATSServerCert').mockReturnValue({
      keyPem: 'NATS_PRIVATE_PEM',
      certPem: 'NATS_CERT_PEM',
    });

    await expect(service.initialize()).rejects.toBeInstanceOf(
      CAUninitializedError,
    );

    expect(fs.writeFile).toHaveBeenCalledTimes(1);
  });
});