import { CallHandler, ExecutionContext, Logger } from '@nestjs/common';
import { of, throwError, firstValueFrom } from 'rxjs';
import { AuditLogInterceptor } from '../src/provisioning/audit-log.interceptor';
import { ProvisioningResult } from '../src/provisioning/model/provisioning-result';
import { SignedCertificate } from '../src/ca/model/signed-certificate';
import { AESKey } from '../src/provisioning/model/aes-key';
import { GatewayIdentity } from '../src/provisioning/model/gateway-identity';
import { NATSRRClient } from '../src/nats/nats-rr.client';
import {
  GatewayAlreadyProvisionedError,
  InvalidFactoryCredentialsError,
  MalformedCSRError,
  ManagementAPIUnavailableError,
} from '../src/provisioning/model/errors';

type RequestLike = {
  body?: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  provisioningResult?: ProvisioningResult;
};

type AuditPayload = {
  factory_id?: unknown;
  source_ip?: unknown;
  outcome?: unknown;
  gateway_id?: unknown;
  tenant_id?: unknown;
};

const parsePayload = (value: unknown): AuditPayload => {
  const parsed: unknown = JSON.parse(String(value));
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid audit log payload');
  }

  return parsed as AuditPayload;
};

const latestPayload = (logSpy: jest.SpyInstance): AuditPayload => {
  const calls = logSpy.mock.calls as unknown[];
  const lastCall = calls[calls.length - 1] as unknown[];
  const firstArg = lastCall[0];

  return parsePayload(firstArg);
};

describe('AuditLogInterceptor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createContext = (request: RequestLike): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => request }),
    }) as unknown as ExecutionContext;

  it('logs successful provisioning with identity fields', async () => {
    const interceptor = new AuditLogInterceptor();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const request: RequestLike = {
      body: {
        credentials: {
          factoryId: 'factory-1',
        },
      },
      headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' },
      provisioningResult: new ProvisioningResult(
        new SignedCertificate('CERT'),
        new AESKey(Buffer.alloc(32, 1)),
        new GatewayIdentity('gw-1', 'tenant-1'),
        5000,
      ),
    };

    const context = createContext(request);
    const handler: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = latestPayload(logSpy);
    expect(payload.factory_id).toBe('factory-1');
    expect(payload.source_ip).toBe('10.0.0.1');
    expect(payload.outcome).toBe('success');
    expect(payload.gateway_id).toBe('gw-1');
    expect(payload.tenant_id).toBe('tenant-1');
  });

  it('publishes successful provisioning audit entries to NATS when tenant is available', async () => {
    const publish = jest.fn().mockResolvedValue(undefined);
    const natsClient = {
      publish,
    } as unknown as NATSRRClient;
    const interceptor = new AuditLogInterceptor(natsClient);

    const request: RequestLike = {
      body: {
        credentials: {
          factoryId: 'factory-1',
        },
      },
      headers: {},
      provisioningResult: new ProvisioningResult(
        new SignedCertificate('CERT'),
        new AESKey(Buffer.alloc(32, 1)),
        new GatewayIdentity('gw-1', 'tenant-1'),
        5000,
      ),
    };

    const context = createContext(request);
    const handler: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(context, handler));

    expect(publish).toHaveBeenCalledWith(
      'log.audit.tenant-1',
      expect.objectContaining({
        action: 'PROVISIONING_ONBOARD_SUCCESS',
        userId: '00000000-0000-0000-0000-000000000000',
      }),
    );
  });

  it('falls back to top-level factory_id when nested credentials are missing', async () => {
    const interceptor = new AuditLogInterceptor();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const request: RequestLike = {
      body: {
        factory_id: 'factory-top-level',
      },
      headers: {},
      provisioningResult: new ProvisioningResult(
        new SignedCertificate('CERT'),
        new AESKey(Buffer.alloc(32, 1)),
        new GatewayIdentity('gw-1', 'tenant-1'),
        5000,
      ),
    };

    const context = createContext(request);
    const handler: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(context, handler));

    const payload = latestPayload(logSpy);
    expect(payload.factory_id).toBe('factory-top-level');
  });

  it('logs a warning when audit publish fails', async () => {
    const publish = jest.fn().mockRejectedValue(new Error('publish failed'));
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const natsClient = {
      publish,
    } as unknown as NATSRRClient;
    const interceptor = new AuditLogInterceptor(natsClient);

    const request: RequestLike = {
      body: {
        credentials: {
          factoryId: 'factory-1',
        },
      },
      headers: {},
      provisioningResult: new ProvisioningResult(
        new SignedCertificate('CERT'),
        new AESKey(Buffer.alloc(32, 1)),
        new GatewayIdentity('gw-1', 'tenant-1'),
        5000,
      ),
    };

    const context = createContext(request);
    const handler: CallHandler = { handle: () => of('ok') };

    await firstValueFrom(interceptor.intercept(context, handler));
    await new Promise((resolve) => setImmediate(resolve));

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('logs mapped failure outcome and rethrows', async () => {
    const interceptor = new AuditLogInterceptor();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const request: RequestLike = {
      body: {
        credentials: {
          factoryId: 'factory-1',
        },
      },
      headers: {},
      ip: '127.0.0.1',
    };

    const context = createContext(request);
    const handler: CallHandler = {
      handle: () => throwError(() => new InvalidFactoryCredentialsError()),
    };

    await expect(
      firstValueFrom(interceptor.intercept(context, handler)),
    ).rejects.toBeInstanceOf(InvalidFactoryCredentialsError);

    const payload = latestPayload(logSpy);
    expect(payload.outcome).toBe('invalid_credentials');
    expect(payload.source_ip).toBe('127.0.0.1');
  });

  it.each([
    [new MalformedCSRError(), 'malformed_csr'],
    [new GatewayAlreadyProvisionedError(), 'already_provisioned'],
    [new ManagementAPIUnavailableError(), 'service_unavailable'],
  ])(
    'logs mapped outcome %s',
    async (error: Error, expectedOutcome: string) => {
      const interceptor = new AuditLogInterceptor();
      const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      const request: RequestLike = {
        body: {
          credentials: {
            factoryId: 'factory-1',
          },
        },
        headers: {},
        ip: '127.0.0.1',
      };

      const context = createContext(request);
      const handler: CallHandler = {
        handle: () => throwError(() => error),
      };

      await expect(
        firstValueFrom(interceptor.intercept(context, handler)),
      ).rejects.toBe(error);

      const payload = latestPayload(logSpy);
      expect(payload.outcome).toBe(expectedOutcome);
    },
  );

  it('logs generic outcome for unknown errors', async () => {
    const interceptor = new AuditLogInterceptor();
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    const request: RequestLike = {
      body: {
        credentials: {
          factoryId: 'factory-1',
        },
      },
      headers: {},
      ip: '127.0.0.1',
    };

    const context = createContext(request);
    const handler: CallHandler = {
      handle: () => throwError(() => new Error('unknown')),
    };

    await expect(
      firstValueFrom(interceptor.intercept(context, handler)),
    ).rejects.toThrow('unknown');

    const payload = latestPayload(logSpy);
    expect(payload.outcome).toBe('error');
  });
});
