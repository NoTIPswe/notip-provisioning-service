import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import type { Request } from 'express';
import { ProvisioningResult } from './model/provisioning-result';
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

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

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
        throw error;
      }),
    );
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
    const factoryId = body?.factory_id;

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
