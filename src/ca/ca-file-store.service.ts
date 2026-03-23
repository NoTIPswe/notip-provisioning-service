import { Injectable, Inject } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as forge from 'node-forge';
import { CARepository } from './interfaces/ca-repository.interface';
import { CAMaterial } from './model/ca-material';
import { NATSServerCertificate } from './model/nats-server-certificate';
import type { ProvisioningConfig } from '../config/provisioning.config';

@Injectable()
export class CAFileStoreService implements CARepository {
  private readonly certsPath: string;

  private readonly caKeyPath: string;
  private readonly caCertPath: string;

  private readonly natsKeyPath: string;
  private readonly natsCertPath: string;

  constructor(@Inject('CONFIG') private config: ProvisioningConfig) {
    this.certsPath = this.config.CA_CERTS_PATH;

    this.caKeyPath = path.join(this.certsPath, 'ca.key');
    this.caCertPath = path.join(this.certsPath, 'ca.crt');

    this.natsKeyPath = path.join(this.certsPath, 'nats.key');
    this.natsCertPath = path.join(this.certsPath, 'nats.crt');
  }

  async caExists(): Promise<boolean> {
    try {
      await fs.access(this.caKeyPath);
      await fs.access(this.caCertPath);
      const keyStat = await fs.stat(this.caKeyPath);
      const certStat = await fs.stat(this.caCertPath);
      return keyStat.size > 0 && certStat.size > 0;
    } catch {
      return false;
    }
  }

  async load(): Promise<CAMaterial> {
    try {
      const keyPem = await fs.readFile(this.caKeyPath, 'utf8');
      const certPem = await fs.readFile(this.caCertPath, 'utf8');
      if (!keyPem || !certPem) {
        throw new Error('CA files empty');
      }
      return new CAMaterial(keyPem, certPem);
    } catch {
      throw new Error('CAUninitializedError');
    }
  }

  async initialize(): Promise<CAMaterial> {
    await fs.mkdir(this.certsPath, { recursive: true });

    const caMaterial = this.generateCA();

    const natsCert = this.generateNATSServerCert(caMaterial);

    await fs.writeFile(this.caKeyPath, caMaterial.privateKeyPem, {
      mode: 0o600,
    });
    await fs.writeFile(this.caCertPath, caMaterial.certificatePem, {
      mode: 0o644,
    });

    await fs.writeFile(this.natsKeyPath, natsCert.keyPem, { mode: 0o600 });
    await fs.writeFile(this.natsCertPath, natsCert.certPem, { mode: 0o644 });

    return caMaterial;
  }

  private generateCA(): CAMaterial {
    const keys = forge.pki.rsa.generateKeyPair(4096);

    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;

    cert.serialNumber = new Date().getTime().toString(16);

    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(
      cert.validity.notBefore.getFullYear() + 10,
    );

    const attrs = [{ name: 'commonName', value: 'NoTIP Internal CA' }];

    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.setExtensions([
      {
        name: 'basicConstraints',
        cA: true,
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        cRLSign: true,
      },
    ]);

    cert.sign(keys.privateKey, forge.md.sha256.create());

    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const certPem = forge.pki.certificateToPem(cert);

    return new CAMaterial(keyPem, certPem);
  }

  private generateNATSServerCert(
    caMaterial: CAMaterial,
  ): NATSServerCertificate {
    const caKey = forge.pki.privateKeyFromPem(caMaterial.privateKeyPem);
    const caCert = forge.pki.certificateFromPem(caMaterial.certificatePem);

    const keys = forge.pki.rsa.generateKeyPair(2048);

    const cert = forge.pki.createCertificate();

    cert.publicKey = keys.publicKey;

    cert.serialNumber = new Date().getTime().toString(16);

    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();

    cert.validity.notAfter.setFullYear(
      cert.validity.notBefore.getFullYear() + 1,
    );

    cert.setSubject([{ name: 'commonName', value: 'nats-server' }]);

    cert.setIssuer(caCert.subject.attributes);

    cert.setExtensions([
      {
        name: 'subjectAltName',
        altNames: [
          {
            type: 2,
            value: 'nats',
          },
        ],
      },
      {
        name: 'keyUsage',
        digitalSignature: true,
      },
      {
        name: 'extKeyUsage',
        serverAuth: true,
      },
    ]);

    cert.sign(caKey, forge.md.sha256.create());

    const keyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const certPem = forge.pki.certificateToPem(cert);

    return new NATSServerCertificate(keyPem, certPem);
  }
}
