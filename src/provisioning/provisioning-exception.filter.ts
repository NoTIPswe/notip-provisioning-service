import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ProvisioningDomainError,
  MalformedCSRError,
  InvalidFactoryCredentialsError,
  GatewayAlreadyProvisionedError,
  ManagementAPIUnavailableError,
} from './model/errors';

@Catch()
export class ProvisioningExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      response
        .status(status)
        .json(typeof body === 'string' ? { error: body } : body);
      return;
    }

    if (exception instanceof MalformedCSRError) {
      response.status(HttpStatus.BAD_REQUEST).json({ error: 'MALFORMED_CSR' });
      return;
    }

    if (exception instanceof InvalidFactoryCredentialsError) {
      response
        .status(HttpStatus.UNAUTHORIZED)
        .json({ error: 'INVALID_CREDENTIALS' });
      return;
    }

    if (exception instanceof GatewayAlreadyProvisionedError) {
      response
        .status(HttpStatus.CONFLICT)
        .json({ error: 'ALREADY_PROVISIONED' });
      return;
    }

    if (exception instanceof ManagementAPIUnavailableError) {
      response
        .status(HttpStatus.SERVICE_UNAVAILABLE)
        .json({ error: 'SERVICE_UNAVAILABLE' });
      return;
    }

    if (exception instanceof ProvisioningDomainError) {
      response
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: 'INTERNAL_ERROR' });
      return;
    }

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ error: 'INTERNAL_ERROR' });
  }
}
