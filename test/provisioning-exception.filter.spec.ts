import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { ProvisioningExceptionFilter } from '../src/provisioning/provisioning-exception.filter';
import {
  GatewayAlreadyProvisionedError,
  InvalidFactoryCredentialsError,
  MalformedCSRError,
  ManagementAPIUnavailableError,
} from '../src/provisioning/model/errors';

describe('ProvisioningExceptionFilter', () => {
  const createHost = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const response = { status };
    const host = {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost;

    return { host, status, json };
  };

  it('maps MalformedCSRError to 400', () => {
    const filter = new ProvisioningExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new MalformedCSRError(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({ error: 'MALFORMED_CSR' });
  });

  it('maps InvalidFactoryCredentialsError to 401', () => {
    const filter = new ProvisioningExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new InvalidFactoryCredentialsError(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.UNAUTHORIZED);
    expect(json).toHaveBeenCalledWith({ error: 'INVALID_CREDENTIALS' });
  });

  it('maps GatewayAlreadyProvisionedError to 409', () => {
    const filter = new ProvisioningExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new GatewayAlreadyProvisionedError(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({ error: 'ALREADY_PROVISIONED' });
  });

  it('maps ManagementAPIUnavailableError to 503', () => {
    const filter = new ProvisioningExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new ManagementAPIUnavailableError(), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(json).toHaveBeenCalledWith({ error: 'SERVICE_UNAVAILABLE' });
  });

  it('maps unknown errors to 500', () => {
    const filter = new ProvisioningExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new Error('boom'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({ error: 'INTERNAL_ERROR' });
  });
});
