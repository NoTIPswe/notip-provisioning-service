import { Injectable, Inject } from '@nestjs/common';
import type { FactoryValidator } from './interfaces/factory-validator.interface';
import type { ProvisioningCompleter } from './interfaces/provisioning-completer.interface';
import type { AESKeyGenerator } from './interfaces/aes-key-generator.interface';
import type { CSRSigner } from './interfaces/csr-signer.interface';
import type { OnboardGateway } from './interfaces/onboard-gateway.interface';
import { ProvisioningRequest } from './model/provisioning-request';
import { ProvisioningResult } from './model/provisioning-result';
import { ProvisioningMetrics } from '../metrics/provisioning.metrics';

@Injectable()
export class ProvisioningService implements OnboardGateway {
  constructor(
    @Inject('FactoryValidator')
    private readonly factoryValidator: FactoryValidator,
    @Inject('ProvisioningCompleter')
    private readonly provisioningCompleter: ProvisioningCompleter,
    @Inject('CSRSigner')
    private readonly csrSigner: CSRSigner,
    @Inject('AESKeyGenerator')
    private readonly aeskeyGenerator: AESKeyGenerator,
    private readonly metrics: ProvisioningMetrics,
  ) {}

  async onboard(request: ProvisioningRequest): Promise<ProvisioningResult> {
    this.metrics.provisioningAttempts.inc();

    try {
      const validateStart = Date.now();
      const identity = await this.factoryValidator.validate(
        request.credentials,
      );
      this.metrics.natsValidateDuration.observe(Date.now() - validateStart);

      const signStart = Date.now();
      const certificate = await this.csrSigner.sign(request.csr, identity);
      this.metrics.csrSigningDuration.observe(Date.now() - signStart);

      const aeskey = this.aeskeyGenerator.generate();

      const completeStart = Date.now();
      await this.provisioningCompleter.complete(identity, aeskey);
      this.metrics.natsCompleteDuration.observe(Date.now() - completeStart);

      this.metrics.provisioningSuccesses.inc();

      return new ProvisioningResult(certificate, aeskey, identity);
    } catch (error) {
      this.metrics.provisioningFailures
        .labels(this.mapFailureReason(error))
        .inc();
      throw error;
    }
  }

  private mapFailureReason(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'error';
    }

    switch (error.name) {
      case 'MalformedCSRError':
        return 'malformed_csr';
      case 'InvalidFactoryCredentialsError':
        return 'invalid_credentials';
      case 'GatewayAlreadyProvisionedError':
        return 'already_provisioned';
      case 'ManagementAPIUnavailableError':
        return 'service_unavailable';
      default:
        return 'error';
    }
  }
}
