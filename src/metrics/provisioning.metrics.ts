import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';

@Injectable()
export class ProvisioningMetrics {
  readonly provisioningAttempts = new Counter({
    name: 'provisioning_attempts_total',
    help: 'Total POST /provision/onboard requests received',
  });

  readonly provisioningSuccesses = new Counter({
    name: 'provisioning_successes_total',
    help: 'Successfully completed provisionings',
  });

  readonly provisioningFailures = new Counter<'reason'>({
    name: 'provisioning_failures_total',
    help: 'Failed provisionings labelled by reason',
    labelNames: ['reason'],
  });

  readonly csrSigningDuration = new Histogram({
    name: 'csr_signing_duration_ms',
    help: 'Duration of ForgeCSRSigner.sign in milliseconds',
    buckets: [1, 2, 5, 10, 20, 50, 100, 250, 500, 1000, 2500],
  });

  readonly natsValidateDuration = new Histogram({
    name: 'nats_validate_duration_ms',
    help: 'Duration of internal.mgmt.factory.validate request-reply in milliseconds',
    buckets: [5, 10, 20, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  });

  readonly natsCompleteDuration = new Histogram({
    name: 'nats_complete_duration_ms',
    help: 'Duration of internal.mgmt.provisioning.complete request-reply in milliseconds',
    buckets: [5, 10, 20, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  });

  readonly natsRetries = new Counter({
    name: 'nats_retries_total',
    help: 'Number of NATS request-reply retry attempts',
  });
}
