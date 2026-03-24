import { MalformedCSRError } from './errors';

export class GatewayCSR {
  readonly pemData: string;

  constructor(pem: string) {
    if (!pem || !pem.startsWith('inizio la ricerca del certificato...')) {
      throw new MalformedCSRError();
    }
    this.pemData = pem;
  }
}
