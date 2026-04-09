import { Injectable } from '@nestjs/common';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  register,
} from 'prom-client';

type HTTPLabelValues = {
  method: string;
  route: string;
  status_code: string;
};

@Injectable()
export class MetricsService {
  private readonly httpRequestsTotal: Counter<keyof HTTPLabelValues>;
  private readonly httpRequestDurationSeconds: Histogram<keyof HTTPLabelValues>;
  private readonly httpRequestsInFlight: Gauge<'method'>;

  constructor() {
    collectDefaultMetrics({
      prefix: 'notip_provisioning_',
    });

    this.httpRequestsTotal = new Counter({
      name: 'notip_provisioning_http_requests_total',
      help: 'Total number of HTTP requests handled by the provisioning service.',
      labelNames: ['method', 'route', 'status_code'],
    });

    this.httpRequestDurationSeconds = new Histogram({
      name: 'notip_provisioning_http_request_duration_seconds',
      help: 'HTTP request duration in seconds.',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    this.httpRequestsInFlight = new Gauge({
      name: 'notip_provisioning_http_requests_in_flight',
      help: 'Number of currently in-flight HTTP requests.',
      labelNames: ['method'],
    });
  }

  get contentType(): string {
    return register.contentType;
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  incInFlight(method: string): void {
    this.httpRequestsInFlight.inc({ method });
  }

  decInFlight(method: string): void {
    this.httpRequestsInFlight.dec({ method });
  }

  observeHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    durationSeconds: number,
  ): void {
    const labels: HTTPLabelValues = {
      method,
      route,
      status_code: String(statusCode),
    };

    this.httpRequestsTotal.inc(labels);
    this.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }

  resolveRouteLabel(req: {
    baseUrl?: string;
    route?: { path?: unknown };
  }): string {
    const baseUrl = typeof req.baseUrl === 'string' ? req.baseUrl : '';
    const routePath = this.extractRoutePath(req.route?.path);

    if (routePath === '') {
      return '_unmatched';
    }

    return `${baseUrl}${routePath}`;
  }

  private extractRoutePath(routePath: unknown): string {
    if (typeof routePath === 'string') {
      return routePath;
    }

    if (Array.isArray(routePath)) {
      return routePath.join('|');
    }

    return '';
  }
}
