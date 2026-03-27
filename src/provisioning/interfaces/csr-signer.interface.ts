import { GatewayCSR } from '../model/gateway-csr';
import { GatewayIdentity } from '../model/gateway-identity';
import { SignedCertificate } from '../../ca/model/signed-certificate';

export interface CSRSigner {
  sign(csr: GatewayCSR, identity: GatewayIdentity): Promise<SignedCertificate>;
}
