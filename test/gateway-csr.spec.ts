import { GatewayCSR } from '../src/provisioning/model/gateway-csr';
import { MalformedCSRError } from '../src/provisioning/model/errors';

describe('GatewayCSR', () => {
  it('accepts a PEM CSR with expected header', () => {
    const pem = '-----BEGIN CERTIFICATE REQUEST-----\nabc';
    const csr = new GatewayCSR(pem);

    expect(csr.pemData).toBe(pem);
  });

  it('throws MalformedCSRError for missing header', () => {
    expect(() => new GatewayCSR('invalid-pem')).toThrow(MalformedCSRError);
  });

  it('throws MalformedCSRError for empty input', () => {
    expect(() => new GatewayCSR('')).toThrow(MalformedCSRError);
  });
});
