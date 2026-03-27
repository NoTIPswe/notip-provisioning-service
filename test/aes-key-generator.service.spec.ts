import * as crypto from 'node:crypto';
import { AESKeyGeneratorService } from '../src/crypto/aes-key-generator.service';

type RandomBytesSync = (size: number) => Buffer;

jest.mock('node:crypto', () => {
  const actual =
    jest.requireActual<typeof import('node:crypto')>('node:crypto');
  const randomBytesMock = jest.fn<
    ReturnType<RandomBytesSync>,
    Parameters<RandomBytesSync>
  >();

  return {
    ...actual,
    randomBytes: randomBytesMock,
  };
});

describe('AESKeyGeneratorService', () => {
  it('generates 32 random bytes and returns AESKey version 1', () => {
    const randomBuffer = Buffer.alloc(32, 3);
    const randomBytesMock =
      crypto.randomBytes as unknown as jest.MockedFunction<RandomBytesSync>;
    randomBytesMock.mockReturnValue(randomBuffer);

    const service = new AESKeyGeneratorService();
    const key = service.generate();

    expect(randomBytesMock).toHaveBeenCalledWith(32);
    expect(key.material).toEqual(randomBuffer);
    expect(key.version).toBe(1);
  });
});
