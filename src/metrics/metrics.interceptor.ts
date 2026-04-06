import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { finalize, Observable } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<'http'>() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<{
      method?: string;
      baseUrl?: string;
      route?: { path?: unknown };
    }>();
    const res = http.getResponse<{ statusCode?: number }>();

    const method = req.method ?? 'UNKNOWN';
    const start = process.hrtime.bigint();

    this.metricsService.incInFlight(method);

    return next.handle().pipe(
      finalize(() => {
        const elapsedNs = process.hrtime.bigint() - start;
        const durationSeconds = Number(elapsedNs) / 1_000_000_000;
        const route = this.metricsService.resolveRouteLabel(req);
        const statusCode = res.statusCode ?? 500;

        this.metricsService.observeHttpRequest(
          method,
          route,
          statusCode,
          durationSeconds,
        );
        this.metricsService.decInFlight(method);
      }),
    );
  }
}
