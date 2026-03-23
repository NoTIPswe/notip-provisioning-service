export class NATSServerCertificate {
  constructor(
    public readonly keyPem: string, //chiave privata server NATS
    public readonly certPem: string, //certificato pubblico server NATS
  ) {}
}
