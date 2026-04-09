import { collectDefaultMetrics, Counter, Gauge, Histogram } from 'prom-client';
import { MetricsService } from '../src/metrics/metrics.service';

const mockCounterInc = jest.fn();
const mockGaugeInc = jest.fn();
const mockGaugeDec = jest.fn();
const mockHistogramObserve = jest.fn();

jest.mock('prom-client', () => ({
  collectDefaultMetrics: jest.fn(),
  register: {
    contentType: 'text/plain; version=0.0.4',
    metrics: jest.fn().mockResolvedValue('metrics-payload'),
  },
  Counter: jest.fn().mockImplementation(() => ({
    inc: mockCounterInc,
  })),
  Gauge: jest.fn().mockImplementation(() => ({
    inc: mockGaugeInc,
    dec: mockGaugeDec,
  })),
  Histogram: jest.fn().mockImplementation(() => ({
    observe: mockHistogramObserve,
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

    service.incInFlight('POST');
    service.decInFlight('POST');
    service.observeHttpRequest('POST', '/provision/onboard', 201, 0.123);

    expect(mockGaugeInc).toHaveBeenCalledWith({ method: 'POST' });
    expect(mockGaugeDec).toHaveBeenCalledWith({ method: 'POST' });
    expect(mockCounterInc).toHaveBeenCalledWith({
      method: 'POST',
      route: '/provision/onboard',
      status_code: '201',
    });
    expect(mockHistogramObserve).toHaveBeenCalledWith(
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
      service.resolveRouteLabel({
        baseUrl: '/api',
        route: { path: '/metrics' },
      }),
    ).toBe('/api/metrics');
    expect(service.resolveRouteLabel({ route: { path: ['/a', '/b'] } })).toBe(
      '/a|/b',
    );
    expect(service.resolveRouteLabel({ route: { path: 123 } })).toBe(
      '_unmatched',
    );
    expect(service.resolveRouteLabel({})).toBe('_unmatched');
  });
});
