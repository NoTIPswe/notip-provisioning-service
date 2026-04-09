import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import type { Request } from 'express';
import { ProvisioningResult } from './model/provisioning-result';
import { NATSRRClient } from '../nats/nats-rr.client';
import {
  MalformedCSRError,
  InvalidFactoryCredentialsError,
  GatewayAlreadyProvisionedError,
  ManagementAPIUnavailableError,
} from './model/errors';

type AuditOutcome =
  | 'success'
  | 'invalid_credentials'
  | 'already_provisioned'
  | 'malformed_csr'
  | 'service_unavailable'
  | 'error';

interface AuditLogEntry {
  timestamp: string;
  factory_id: string;
  source_ip: string;
  outcome: AuditOutcome;
  gateway_id?: string;
  tenant_id?: string;
}

interface NatsAuditLogEntry {
  userId: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  timestamp: string;
}

const AUDIT_SUBJECT_PREFIX = 'log.audit.';
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  constructor(@Optional() private readonly natsClient?: NATSRRClient) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const timestamp = new Date().toISOString();
    const factoryId = this.extractFactoryId(request);
    const sourceIp = this.extractSourceIp(request);

    return next.handle().pipe(
      tap(() => {
        const result = request.provisioningResult;
        const { gatewayId, tenantId } = this.extractIdentityFromResult(result);
        const entry: AuditLogEntry = {
          timestamp,
          factory_id: factoryId,
          source_ip: sourceIp,
          outcome: 'success',
          gateway_id: gatewayId,
          tenant_id: tenantId,
        };
        this.logger.log(JSON.stringify(entry));
        this.publishAudit(entry);
      }),
      catchError((error) => {
        const outcome = this.mapErrorToOutcome(error);
        const entry: AuditLogEntry = {
          timestamp,
          factory_id: factoryId,
          source_ip: sourceIp,
          outcome,
        };
        this.logger.log(JSON.stringify(entry));
        this.publishAudit(entry);
        throw error;
      }),
    );
  }

  private publishAudit(entry: AuditLogEntry): void {
    if (!entry.tenant_id || !this.natsClient) {
      return;
    }

    const subject = `${AUDIT_SUBJECT_PREFIX}${entry.tenant_id}`;
    const payload: NatsAuditLogEntry = {
      userId: SYSTEM_USER_ID,
      action: this.mapOutcomeToAction(entry.outcome),
      resource: entry.gateway_id || entry.factory_id || 'provisioning/onboard',
      details: {
        factoryId: entry.factory_id,
        sourceIp: entry.source_ip,
        outcome: entry.outcome,
        gatewayId: entry.gateway_id,
        tenantId: entry.tenant_id,
      },
      timestamp: entry.timestamp,
    };

    void this.natsClient.publish(subject, payload).catch((error) => {
      this.logger.warn(
        `Failed to publish provisioning audit event on subject ${subject}`,
        error instanceof Error ? error.stack : String(error),
      );
    });
  }

  private mapOutcomeToAction(outcome: AuditOutcome): string {
    return `PROVISIONING_ONBOARD_${outcome.toUpperCase()}`;
  }

  private extractSourceIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(',')[0].trim();
    }
    return request.ip || 'unknown';
  }

  private extractFactoryId(request: Request): string {
    const body = request.body as Record<string, unknown> | undefined;
    const nestedCredentials = body?.credentials as
      | Record<string, unknown>
      | undefined;
    const factoryId = nestedCredentials?.factoryId ?? body?.factory_id;

    if (typeof factoryId === 'string' && factoryId.length > 0) {
      return factoryId;
    }

    return 'unknown';
  }

  private mapErrorToOutcome(error: unknown): AuditOutcome {
    if (error instanceof MalformedCSRError) {
      return 'malformed_csr';
    }
    if (error instanceof InvalidFactoryCredentialsError) {
      return 'invalid_credentials';
    }
    if (error instanceof GatewayAlreadyProvisionedError) {
      return 'already_provisioned';
    }
    if (error instanceof ManagementAPIUnavailableError) {
      return 'service_unavailable';
    }
    return 'error';
  }

  private extractIdentityFromResult(result?: ProvisioningResult): {
    gatewayId?: string;
    tenantId?: string;
  } {
    if (!result) return {};
    return {
      gatewayId: result.identity.gatewayId,
      tenantId: result.identity.tenantId,
    };
  }
}
