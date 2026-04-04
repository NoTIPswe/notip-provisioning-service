import * as forge from 'node-forge';
import { ForgeCSRSignerService } from '../src/ca/forge-csr-signer.service';
import { CAMaterial } from '../src/ca/model/ca-material';
import { GatewayCSR } from '../src/provisioning/model/gateway-csr';
import { GatewayIdentity } from '../src/provisioning/model/gateway-identity';
import { MalformedCSRError } from '../src/provisioning/model/errors';

type SubjectAltNameExtension = {
  altNames?: Array<{ type: number; value?: string; ip?: string }>;
};

describe('ForgeCSRSignerService', () => {
  const buildCA = () => {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const attrs = [{ name: 'commonName', value: 'Test CA' }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([{ name: 'basicConstraints', cA: true }]);
    cert.sign(keys.privateKey, forge.md.sha256.create());

    return new CAMaterial(
      forge.pki.privateKeyToPem(keys.privateKey),
      forge.pki.certificateToPem(cert),
    );
  };

  const buildValidCsrPem = () => {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const csr = forge.pki.createCertificationRequest();
    csr.publicKey = keys.publicKey;
    csr.setSubject([{ name: 'commonName', value: 'gateway-csr' }]);
    csr.sign(keys.privateKey, forge.md.sha256.create());
    return forge.pki.certificationRequestToPem(csr);
  };

  it('signs a valid CSR and sets identity-based CN and SAN', async () => {
    const caMaterial = buildCA();
    const caProvider = { getCA: jest.fn().mockReturnValue(caMaterial) };
    const config = { CERT_TTL_DAYS: 90 };
    const service = new ForgeCSRSignerService(
      caProvider as never,
      config as never,
    );

    const identity = new GatewayIdentity('gw-1', 'tenant-1');
    const result = await service.sign(
      new GatewayCSR(buildValidCsrPem()),
      identity,
    );

    const cert = forge.pki.certificateFromPem(result.pemData);
    const cnAttr = cert.subject.attributes.find(
      (attribute) => attribute.name === 'commonName',
    );
    const cn = cnAttr?.value;
    const san = cert.getExtension(
      'subjectAltName',
    ) as SubjectAltNameExtension | null;

    expect(caProvider.getCA).toHaveBeenCalledTimes(1);
    expect(cn).toBe('gw-1');
    expect(san?.altNames?.[0]?.value).toBe(
      'gw-1.tenant-1.gateways.notip.internal',
    );
  });

  it('generates a positive certificate serial number', async () => {
    const caProvider = { getCA: jest.fn().mockReturnValue(buildCA()) };
    const config = { CERT_TTL_DAYS: 90 };
    const service = new ForgeCSRSignerService(
      caProvider as never,
      config as never,
    );

    const result = await service.sign(
      new GatewayCSR(buildValidCsrPem()),
      new GatewayIdentity('gw-serial', 'tenant-serial'),
    );

    const cert = forge.pki.certificateFromPem(result.pemData);
    const serialHex = cert.serialNumber.padStart(2, '0');
    const firstByte = parseInt(serialHex.slice(0, 2), 16);

    expect(firstByte & 0x80).toBe(0);
    expect(/^0+$/.test(serialHex)).toBe(false);
  });

  it('throws MalformedCSRError when CSR cannot be parsed', async () => {
    const caProvider = { getCA: jest.fn().mockReturnValue(buildCA()) };
    const config = { CERT_TTL_DAYS: 90 };
    const service = new ForgeCSRSignerService(
      caProvider as never,
      config as never,
    );

    const invalidCsr = new GatewayCSR(
      '-----BEGIN CERTIFICATE REQUEST-----\nnot-a-real-csr',
    );

    await expect(
      service.sign(invalidCsr, new GatewayIdentity('gw-1', 'tenant-1')),
    ).rejects.toBeInstanceOf(MalformedCSRError);
  });

  it('throws MalformedCSRError when CSR signature is invalid', async () => {
    const caProvider = { getCA: jest.fn().mockReturnValue(buildCA()) };
    const config = { CERT_TTL_DAYS: 90 };
    const service = new ForgeCSRSignerService(
      caProvider as never,
      config as never,
    );

    const verifyMock = jest.fn().mockReturnValue(false);
    const csrMock = {
      verify: verifyMock,
    } as unknown as forge.pki.CertificateSigningRequest;

    const parseSpy = jest
      .spyOn(forge.pki, 'certificationRequestFromPem')
      .mockReturnValue(csrMock);

    await expect(
      service.sign(
        new GatewayCSR(
          '-----BEGIN CERTIFICATE REQUEST-----\ncorrupted-signature',
        ),
        new GatewayIdentity('gw-1', 'tenant-1'),
      ),
    ).rejects.toBeInstanceOf(MalformedCSRError);

    expect(parseSpy).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledTimes(1);
  });
});
