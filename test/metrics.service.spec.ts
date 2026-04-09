import { collectDefaultMetrics, Counter, Gauge, Histogram, register } from 'prom-client';
import { MetricsService } from '../src/metrics/metrics.service';

jest.mock('prom-client', () => ({
  collectDefaultMetrics: jest.fn(),
  register: {
    contentType: 'text/plain; version=0.0.4',
    metrics: jest.fn().mockResolvedValue('metrics-payload'),
  },
  Counter: jest.fn().mockImplementation(() => ({
    inc: jest.fn(),
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    inc: jest.fn(),
    dec: jest.fn(),
  })),
  Histogram: jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
  })),
}));

describe('MetricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('initializes default and custom metrics', async () => {
    const service = new MetricsService();

    expect(collectDefaultMetrics).toHaveBeenCalledWith({
      prefix: 'notip_provisioning_',
    });

    expect(Counter).toHaveBeenCalledTimes(1);
    expect(Gauge).toHaveBeenCalledTimes(1);
    expect(Histogram).toHaveBeenCalledTimes(1);

    expect(service.contentType).toBe('text/plain; version=0.0.4');
    await expect(service.getMetrics()).resolves.toBe('metrics-payload');
  });

  it('updates HTTP metric primitives', () => {
    const service = new MetricsService();
    const counterInstance = (Counter as unknown as jest.Mock).mock.results[0].value;
    const histogramInstance = (Histogram as unknown as jest.Mock).mock.results[0].value;
    const gaugeInstance = (Gauge as unknown as jest.Mock).mock.results[0].value;

    service.incInFlight('POST');
    service.decInFlight('POST');
    service.observeHttpRequest('POST', '/provision/onboard', 201, 0.123);

    expect(gaugeInstance.inc).toHaveBeenCalledWith({ method: 'POST' });
    expect(gaugeInstance.dec).toHaveBeenCalledWith({ method: 'POST' });
    expect(counterInstance.inc).toHaveBeenCalledWith({
      method: 'POST',
      route: '/provision/onboard',
      status_code: '201',
    });
    expect(histogramInstance.observe).toHaveBeenCalledWith(
      {
        method: 'POST',
        route: '/provision/onboard',
        status_code: '201',
      },
      0.123,
    );
  });

  it('resolves route labels for all route shapes', () => {
    const service = new MetricsService();

    expect(
      service.resolveRouteLabel({ baseUrl: '/api', route: { path: '/metrics' } }),
    ).toBe('/api/metrics');
    expect(
      service.resolveRouteLabel({ route: { path: ['/a', '/b'] } }),
    ).toBe('/a|/b');
    expect(service.resolveRouteLabel({ route: { path: 123 } })).toBe(
      '_unmatched',
    );
    expect(service.resolveRouteLabel({})).toBe('_unmatched');
  });
});