//sbagliato
import { Injectable } from '@nestjs/common';
import * as forge from 'node-forge';
import { SignedCertificate } from './model/signed-certificate';
import { CAMaterial } from './model/ca-material';

@Injectable()
export class ForgeCSRSignerService {
  sign(csrPem: string, ca: CAMaterial, daysValid: number): SignedCertificate {
    const csr = forge.pki.certificationRequestFromPem(csrPem);
    const caKey = forge.pki.privateKeyFromPem(ca.privateKeyPem);
    const caCert = forge.pki.certificateFromPem(ca.certificatePem);

    if (!csr.publicKey) {
      throw new Error('Invalid CSR: missing public key');
    }

    const cert = forge.pki.createCertificate();
    cert.publicKey = csr.publicKey;
    cert.serialNumber = forge.util.bytesToHex(forge.random.getBytesSync(16));
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setDate(
      cert.validity.notBefore.getDate() + daysValid,
    );

    cert.setSubject(csr.subject.attributes);
    cert.setIssuer(caCert.subject.attributes);

    // Firma con SHA-256
    cert.sign(caKey, forge.md.sha256.create());

    return new SignedCertificate(forge.pki.certificateToPem(cert));
  }
}
