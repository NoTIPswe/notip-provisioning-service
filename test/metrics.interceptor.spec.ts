import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { MetricsInterceptor } from '../src/metrics/metrics.interceptor';

describe('MetricsInterceptor', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('passes through non-http contexts without recording metrics', async () => {
    const metricsService = {
      incInFlight: jest.fn(),
      decInFlight: jest.fn(),
      resolveRouteLabel: jest.fn(),
      observeHttpRequest: jest.fn(),
    };
    const interceptor = new MetricsInterceptor(metricsService as never);

    const context = {
      getType: jest.fn().mockReturnValue('ws'),
      switchToHttp: jest.fn(),
    } as unknown as ExecutionContext;
    const handler: CallHandler = {
      handle: () => of('ok'),
    };

    await expect(firstValueFrom(interceptor.intercept(context, handler))).resolves.toBe('ok');

    expect(metricsService.incInFlight).not.toHaveBeenCalled();
    expect(metricsService.observeHttpRequest).not.toHaveBeenCalled();
  });

  it('records timing and status for http requests', async () => {
    const metricsService = {
      incInFlight: jest.fn(),
      decInFlight: jest.fn(),
      resolveRouteLabel: jest.fn().mockReturnValue('/api/metrics'),
      observeHttpRequest: jest.fn(),
    };
    const interceptor = new MetricsInterceptor(metricsService as never);

    const context = {
      getType: jest.fn().mockReturnValue('http'),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({
          method: 'GET',
          baseUrl: '/api',
          route: { path: '/metrics' },
        }),
        getResponse: jest.fn().mockReturnValue({ statusCode: 204 }),
      }),
    } as unknown as ExecutionContext;
    const handler: CallHandler = {
      handle: () => of('ok'),
    };

    await expect(firstValueFrom(interceptor.intercept(context, handler))).resolves.toBe('ok');

    expect(metricsService.incInFlight).toHaveBeenCalledWith('GET');
    expect(metricsService.resolveRouteLabel).toHaveBeenCalled();
    expect(metricsService.observeHttpRequest).toHaveBeenCalledWith(
      'GET',
      '/api/metrics',
      204,
      expect.any(Number),
    );
    expect(metricsService.decInFlight).toHaveBeenCalledWith('GET');
  });
});