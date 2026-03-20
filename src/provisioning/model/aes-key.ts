export class AESKey {
  /**
   * @param material I 32 byte della chiave (256 bit)
   * @param version La versione della chiave (default 1)
   */
  constructor(
    public readonly material: Buffer,
    public readonly version: number = 1,
  ) {
    if (material.length !== 32) {
      throw new Error('La chiave AES-256 deve essere esattamente di 32 byte');
    }
  }

  toBase64(): string {
    return this.material.toString('base64');
  }
}
