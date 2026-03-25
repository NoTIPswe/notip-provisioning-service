import { AESKey } from '../src/provisioning/model/aes-key';

describe('AESKey', () => {
  it('creates a valid AES-256 key and converts to base64', () => {
    const material = Buffer.alloc(32, 1);
    const key = new AESKey(material);

    expect(key.version).toBe(1);
    expect(key.toBase64()).toBe(material.toString('base64'));
  });

  it('throws for invalid key length', () => {
    expect(() => new AESKey(Buffer.alloc(31))).toThrow(
      'La chiave AES-256 deve essere esattamente di 32 byte',
    );
  });
});
