import { Injectable } from '@nestjs/common';
import * as forge from 'node-forge';
import { SignedCertificate } from './model/signed-certificate';
import type { CSRSigner } from '../provisioning/interfaces/csr-signer.interface';
import { GatewayCSR } from '../provisioning/model/gateway-csr';
import { GatewayIdentity } from '../provisioning/model/gateway-identity';
import type { CAProvider } from './interfaces/ca-provider.interface';
import type { ProvisioningConfig } from '../config/provisioning.config';
import { Inject } from '@nestjs/common';
import { MalformedCSRError } from '../provisioning/model/errors';

@Injectable()
export class ForgeCSRSignerService implements CSRSigner {
  constructor(
    @Inject('CAProvider') private readonly caProvider: CAProvider,
    @Inject('CONFIG') private readonly config: ProvisioningConfig,
  ) {}

  async sign(
    csr: GatewayCSR,
    identity: GatewayIdentity,
  ): Promise<SignedCertificate> {
    const caMaterial = this.caProvider.getCA();
    const caKey = forge.pki.privateKeyFromPem(caMaterial.privateKeyPem);
    const caCert = forge.pki.certificateFromPem(caMaterial.certificatePem);

    const parsedCsr = this.parseCSR(csr);
    this.validateCSR(parsedCsr);

    const certificate = this.buildCertificate(
      parsedCsr,
      identity,
      caKey,
      caCert,
    );
    const pemData = forge.pki.certificateToPem(certificate);

    return await Promise.resolve(new SignedCertificate(pemData));
  }

  private parseCSR(csr: GatewayCSR): forge.pki.CertificateSigningRequest {
    try {
      return forge.pki.certificationRequestFromPem(csr.pemData);
    } catch {
      throw new MalformedCSRError();
    }
  }

  private validateCSR(csr: forge.pki.CertificateSigningRequest): void {
    if (!csr.verify()) {
      throw new MalformedCSRError();
    }
  }

  private buildCertificate(
    csr: forge.pki.CertificateSigningRequest,
    identity: GatewayIdentity,
    caKey: forge.pki.rsa.PrivateKey,
    caCert: forge.pki.Certificate,
  ): forge.pki.Certificate {
    const publicKey = csr.publicKey;
    if (!publicKey) {
      throw new MalformedCSRError();
    }

    const cert = forge.pki.createCertificate();
    cert.publicKey = publicKey;
    cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(16));

    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date(
      cert.validity.notBefore.getTime() +
        this.config.CERT_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    cert.setSubject([{ name: 'commonName', value: identity.gatewayId }]);
    cert.setIssuer(caCert.subject.attributes);

    cert.setExtensions([
      {
        name: 'subjectAltName',
        altNames: [
          {
            type: 2,
            value: `${identity.gatewayId}.${identity.tenantId}.gateways.notip.internal`,
          },
        ],
      },
      {
        name: 'keyUsage',
        digitalSignature: true,
      },
      {
        name: 'extKeyUsage',
        clientAuth: true,
      },
    ]);

    cert.sign(caKey, forge.md.sha256.create());
    return cert;
  }
}
