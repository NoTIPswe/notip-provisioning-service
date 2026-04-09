import { Logger } from '@nestjs/common';
import { connect, JSONCodec, NatsConnection, NatsError } from 'nats';
import { NATSRRClient } from '../src/nats/nats-rr.client';
import { ManagementAPIUnavailableError } from '../src/provisioning/model/errors';

jest.mock('nats', () => {
  const actual = jest.requireActual<typeof import('nats')>('nats');
  return {
    ...actual,
    connect: jest.fn(),
  };
});

type Config = {
  NATS_URL: string;
  NATS_CREDENTIALS: string;
  NATS_REQUEST_TIMEOUT_MS: number;
  NATS_MAX_RETRIES: number;
};

type MetricsLike = {
  natsRetries: { inc: jest.Mock };
};

type MockConnection = {
  request: jest.Mock;
  publish: jest.Mock;
  close: jest.Mock;
};

describe('NATSRRClient', () => {
  const jc = JSONCodec();

  const baseConfig: Config = {
    NATS_URL: 'nats://localhost:4222',
    NATS_CREDENTIALS: 'token-123',
    NATS_REQUEST_TIMEOUT_MS: 5000,
    NATS_MAX_RETRIES: 3,
  };

  const buildMockConnection = (): MockConnection => ({
    request: jest.fn(),
    publish: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });

  it('uses token credentials when connecting', async () => {
    const mockConnection = buildMockConnection();
    const connectMock = connect as jest.MockedFunction<typeof connect>;
    connectMock.mockResolvedValue(mockConnection as NatsConnection);

    const metrics: MetricsLike = { natsRetries: { inc: jest.fn() } };
    const client = new NATSRRClient(baseConfig as never, metrics as never);

    await client.onModuleInit();

    expect(connectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        servers: 'nats://localhost:4222',
        timeout: 5000,
        token: 'token-123',
      }),
    );
  });

  it('uses user/pass credentials when connecting', async () => {
    const mockConnection = buildMockConnection();
    const connectMock = connect as jest.MockedFunction<typeof connect>;
    connectMock.mockResolvedValue(mockConnection as NatsConnection);

    const metrics: MetricsLike = { natsRetries: { inc: jest.fn() } };
    const client = new NATSRRClient(
      { ...baseConfig, NATS_CREDENTIALS: 'alice:secret' } as never,
      metrics as never,
    );

    await client.onModuleInit();

    expect(connectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user: 'alice',
        pass: 'secret',
      }),
    );
  });

  it('uses mTLS options when certificates are configured', async () => {
    const mockConnection = buildMockConnection();
    const connectMock = connect as jest.MockedFunction<typeof connect>;
    connectMock.mockResolvedValue(mockConnection as NatsConnection);

    const metrics: MetricsLike = { natsRetries: { inc: jest.fn() } };
    const client = new NATSRRClient(
      {
        ...baseConfig,
        NATS_CREDENTIALS: 'token-123',
        NATS_TLS_CA: '/tmp/ca.pem',
        NATS_TLS_CERT: '/tmp/cert.pem',
        NATS_TLS_KEY: '/tmp/key.pem',
      } as never,
      metrics as never,
    );

    await client.onModuleInit();

    expect(connectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tls: {
          caFile: '/tmp/ca.pem',
          certFile: '/tmp/cert.pem',
          keyFile: '/tmp/key.pem',
        },
      }),
    );
  });

  it('returns decoded payload on successful request', async () => {
    const mockConnection = buildMockConnection();
    (mockConnection.request as jest.Mock).mockResolvedValue({
      data: jc.encode({ ok: true }),
    });

    const connectMock = connect as jest.MockedFunction<typeof connect>;
    connectMock.mockResolvedValue(mockConnection as NatsConnection);

    const metrics: MetricsLike = { natsRetries: { inc: jest.fn() } };
    const client = new NATSRRClient(baseConfig as never, metrics as never);

    const response = await client.request<{ ok: boolean }>('subject.test', {
      x: 1,
    });

    expect(response).toEqual({ ok: true });
  });

  it('publishes payloads successfully', async () => {
    const mockConnection = buildMockConnection();

    const connectMock = connect as jest.MockedFunction<typeof connect>;
    connectMock.mockResolvedValue(mockConnection as NatsConnection);

    const metrics: MetricsLike = { natsRetries: { inc: jest.fn() } };
    const client = new NATSRRClient(baseConfig as never, metrics as never);

    await client.publish('subject.publish', { ok: true });

    expect(mockConnection.publish).toHaveBeenCalledWith(
      'subject.publish',
      expect.any(Uint8Array),
    );
  });

  it('closes the active connection on module destroy', async () => {
    const mockConnection = buildMockConnection();
    const connectMock = connect as jest.MockedFunction<typeof connect>;
    connectMock.mockResolvedValue(mockConnection as NatsConnection);

    const metrics: MetricsLike = { natsRetries: { inc: jest.fn() } };
    const client = new NATSRRClient(baseConfig as never, metrics as never);

    await client.onModuleInit();
    await client.onModuleDestroy();

    expect(mockConnection.close).toHaveBeenCalledTimes(1);
  });

  it('throws when a single request attempt cannot obtain a connection', async () => {
    const metrics: MetricsLike = { natsRetries: { inc: jest.fn() } };
    const client = new NATSRRClient(
      { ...baseConfig, NATS_MAX_RETRIES: 1 } as never,
      metrics as never,
    );

    jest.spyOn(client as never, 'initConnection').mockResolvedValue(undefined);

    await expect(
      client.request('subject.no-conn', { x: 1 }),
    ).rejects.toBeInstanceOf(ManagementAPIUnavailableError);
  });

  it('throws when a single publish attempt cannot obtain a connection', async () => {
    const metrics: MetricsLike = { natsRetries: { inc: jest.fn() } };
    const client = new NATSRRClient(
      { ...baseConfig, NATS_MAX_RETRIES: 1 } as never,
      metrics as never,
    );

    jest.spyOn(client as never, 'initConnection').mockResolvedValue(undefined);

    await expect(
      client.publish('subject.no-conn', { x: 1 }),
    ).rejects.toBeInstanceOf(ManagementAPIUnavailableError);
  });

  it('retries and throws ManagementAPIUnavailableError after max attempts', async () => {
    const mockConnection = buildMockConnection();
    (mockConnection.request as jest.Mock).mockRejectedValue(
      new Error('nats down'),
    );

    const connectMock = connect as jest.MockedFunction<typeof connect>;
    connectMock.mockResolvedValue(mockConnection as NatsConnection);

    const metrics: MetricsLike = { natsRetries: { inc: jest.fn() } };
    const client = new NATSRRClient(baseConfig as never, metrics as never);

    jest.spyOn(globalThis, 'setTimeout').mockImplementation((handler) => {
      if (typeof handler === 'function') {
        handler();
      }

      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    await expect(
      client.request('subject.fail', { x: 1 }),
    ).rejects.toBeInstanceOf(ManagementAPIUnavailableError);

    // With 3 attempts total, retries happen only after attempt 1 and 2.
    expect(metrics.natsRetries.inc).toHaveBeenCalledTimes(2);
  });

  it('reconnects on NatsError and succeeds on a later attempt', async () => {
    const firstConnection = buildMockConnection();
    (firstConnection.request as jest.Mock).mockRejectedValue(
      new NatsError('connection issue', 'CONNECTION_ERROR'),
    );

    const secondConnection = buildMockConnection();
    (secondConnection.request as jest.Mock).mockResolvedValue({
      data: jc.encode({ ok: true }),
    });

    const connectMock = connect as jest.MockedFunction<typeof connect>;
    connectMock
      .mockResolvedValueOnce(firstConnection as NatsConnection)
      .mockResolvedValueOnce(secondConnection as NatsConnection);

    const metrics: MetricsLike = { natsRetries: { inc: jest.fn() } };
    const client = new NATSRRClient(baseConfig as never, metrics as never);

    jest.spyOn(globalThis, 'setTimeout').mockImplementation((handler) => {
      if (typeof handler === 'function') {
        handler();
      }

      return 0 as unknown as ReturnType<typeof setTimeout>;
    });

    const response = await client.request<{ ok: boolean }>(
      'subject.reconnect',
      {
        x: 1,
      },
    );

    expect(response).toEqual({ ok: true });
    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(metrics.natsRetries.inc).toHaveBeenCalledTimes(1);
  });

  it('fails request and publish when retries are disabled', async () => {
    const connectMock = connect as jest.MockedFunction<typeof connect>;
    connectMock.mockResolvedValue({
      request: jest.fn(),
      publish: jest.fn(),
      close: jest.fn(),
    } as never);

    const metrics: MetricsLike = { natsRetries: { inc: jest.fn() } };

    const requestClient = new NATSRRClient(
      { ...baseConfig, NATS_MAX_RETRIES: 0 } as never,
      metrics as never,
    );
    await expect(
      requestClient.request('subject.zero', { x: 1 }),
    ).rejects.toBeInstanceOf(ManagementAPIUnavailableError);

    const publishClient = new NATSRRClient(
      { ...baseConfig, NATS_MAX_RETRIES: 0 } as never,
      metrics as never,
    );
    await expect(
      publishClient.publish('subject.zero', { x: 1 }),
    ).rejects.toBeInstanceOf(ManagementAPIUnavailableError);
  });

  it('throws when a single request attempt cannot obtain a connection', async () => {
    const metrics: MetricsLike = { natsRetries: { inc: jest.fn() } };
    const client = new NATSRRClient(
      { ...baseConfig, NATS_MAX_RETRIES: 1 } as never,
      metrics as never,
    );

    jest.spyOn(client as never, 'initConnection').mockResolvedValue(undefined);

    await expect(
      client.request('subject.no-conn', { x: 1 }),
    ).rejects.toBeInstanceOf(ManagementAPIUnavailableError);
  });

  it('throws when a single publish attempt cannot obtain a connection', async () => {
    const metrics: MetricsLike = { natsRetries: { inc: jest.fn() } };
    const client = new NATSRRClient(
      { ...baseConfig, NATS_MAX_RETRIES: 1 } as never,
      metrics as never,
    );

    jest.spyOn(client as never, 'initConnection').mockResolvedValue(undefined);

    await expect(
      client.publish('subject.no-conn', { x: 1 }),
    ).rejects.toBeInstanceOf(ManagementAPIUnavailableError);
  });
});
