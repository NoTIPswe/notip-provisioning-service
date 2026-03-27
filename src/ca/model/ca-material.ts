export class CAMaterial {
  constructor(
    public readonly privateKeyPem: string, //chiave privata
    public readonly certificatePem: string, //certificato
  ) {}
}
