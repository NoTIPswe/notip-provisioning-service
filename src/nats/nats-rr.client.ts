import { Injectable, Inject } from '@nestjs/common';
import { connect, NatsConnection, JSONCodec } from 'nats';
import type { ProvisioningConfig } from '../config/provisioning.config';
import { ManagementAPIUnavailableError } from '../provisioning/model/errors';

@Injectable()
export class NATSRRClient {
  private nc: NatsConnection;
  private readonly jc = JSONCodec();

  constructor(@Inject('CONFIG') private readonly config: ProvisioningConfig) {}

  //implementa la logica di retry esponenziale
  async request<T>(subject: string, payload: unknown): Promise<T> {
    for (let i = 0; i < this.config.NATS_MAX_RETRIES; i++) {
      try {
        if (!this.nc) await this.initConnection();

        const resp = await this.nc.request(subject, this.jc.encode(payload), {
          timeout: this.config.NATS_REQUEST_TIMEOUT_MS,
        });
        return this.jc.decode(resp.data) as T;
      } catch {
        await new Promise((res) => setTimeout(res, Math.pow(2, i) * 1000));
      }
    }
    //se i tentativi falliscono, lancia l'errore del dominio
    throw new ManagementAPIUnavailableError();
  }

  private async initConnection() {
    this.nc = await connect({ servers: this.config.NATS_URL });
  }
}
