import { MalformedCSRError } from './errors';

export class GatewayCSR {
  readonly pemData: string;

  constructor(pem: string) {
    if (!pem || !pem.startsWith('-----BEGIN CERTIFICATE REQUEST-----')) {
      throw new MalformedCSRError();
    }
    this.pemData = pem;
  }
}
