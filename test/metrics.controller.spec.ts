import { MetricsController } from '../src/metrics/metrics.controller';

describe('MetricsController', () => {
  it('returns the Prometheus content type and payload', async () => {
    const metricsService = {
      contentType: 'text/plain; version=0.0.4',
      getMetrics: jest.fn().mockResolvedValue('metrics-payload'),
    };
    const controller = new MetricsController(metricsService as never);

    const setHeader = jest.fn();
    const send = jest.fn();
    const response = { setHeader, send } as never;

    await controller.metrics(response);

    expect(setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'text/plain; version=0.0.4',
    );
    expect(send).toHaveBeenCalledWith('metrics-payload');
  });
});
