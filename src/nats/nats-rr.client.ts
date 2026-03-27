import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  connect,
  NatsConnection,
  JSONCodec,
  ConnectionOptions,
  NatsError,
} from 'nats';
import type { ProvisioningConfig } from '../config/provisioning.config';
import { ManagementAPIUnavailableError } from '../provisioning/model/errors';
import { ProvisioningMetrics } from '../metrics/provisioning.metrics';

@Injectable()
export class NATSRRClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NATSRRClient.name);
  private nc: NatsConnection | null = null;
  private readonly jc = JSONCodec();

  constructor(
    @Inject('CONFIG') private readonly config: ProvisioningConfig,
    private readonly metrics: ProvisioningMetrics,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initConnection();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.nc) {
      await this.nc.close();
      this.nc = null;
    }
  }

  async request<T>(subject: string, payload: unknown): Promise<T> {
    const totalAttempts = this.config.NATS_MAX_RETRIES;

    for (let attempt = 1; attempt <= totalAttempts; attempt++) {
      try {
        if (!this.nc) {
          await this.initConnection();
        }

        if (!this.nc) {
          throw new ManagementAPIUnavailableError();
        }

        const resp = await this.nc.request(subject, this.jc.encode(payload), {
          timeout: this.config.NATS_REQUEST_TIMEOUT_MS,
        });

        return this.jc.decode(resp.data) as T;
      } catch (error) {
        if (attempt >= totalAttempts) {
          throw new ManagementAPIUnavailableError();
        }

        this.metrics.natsRetries.inc();
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        this.logger.warn(
          `NATS request failed for subject ${subject}. Retrying in ${backoffMs}ms`,
        );

        await new Promise((resolve) => setTimeout(resolve, backoffMs));

        if (error instanceof NatsError) {
          this.nc = null;
        }
      }
    }

    throw new ManagementAPIUnavailableError();
  }

  private async initConnection(): Promise<void> {
    const options = this.buildConnectionOptions();
    this.nc = await connect(options);
  }

  private buildConnectionOptions(): ConnectionOptions {
    const options: ConnectionOptions = {
      servers: this.config.NATS_URL,
      timeout: this.config.NATS_REQUEST_TIMEOUT_MS,
    };

    if (this.config.NATS_CREDENTIALS.includes(':')) {
      const [user, pass] = this.config.NATS_CREDENTIALS.split(':', 2);
      options.user = user;
      options.pass = pass;
      return options;
    }

    options.token = this.config.NATS_CREDENTIALS;
    return options;
  }
}
