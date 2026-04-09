import { ProvisioningService } from '../src/provisioning/provisioning.service';
import { FactoryCredentials } from '../src/provisioning/model/factory-credentials';
import { GatewayCSR } from '../src/provisioning/model/gateway-csr';
import { ProvisioningRequest } from '../src/provisioning/model/provisioning-request';
import { GatewayIdentity } from '../src/provisioning/model/gateway-identity';
import { SignedCertificate } from '../src/ca/model/signed-certificate';
import { AESKey } from '../src/provisioning/model/aes-key';
import {
  ManagementAPIUnavailableError,
  InvalidFactoryCredentialsError,
  MalformedCSRError,
} from '../src/provisioning/model/errors';

describe('ProvisioningService', () => {
  const buildMetrics = () => {
    const failureInc = jest.fn();

    return {
      provisioningAttempts: { inc: jest.fn() },
      natsValidateDuration: { observe: jest.fn() },
      csrSigningDuration: { observe: jest.fn() },
      natsCompleteDuration: { observe: jest.fn() },
      provisioningSuccesses: { inc: jest.fn() },
      provisioningFailures: {
        labels: jest.fn().mockReturnValue({ inc: failureInc }),
      },
      natsRetries: { inc: jest.fn() },
      failureInc,
    };
  };

  const buildRequest = () =>
    new ProvisioningRequest(
      new FactoryCredentials('factory-1', 'factory-key-1'),
      new GatewayCSR('-----BEGIN CERTIFICATE REQUEST-----\nabc'),
      5000,
      '1.2.3',
    );

  it('orchestrates successful onboarding in order', async () => {
    const identity = new GatewayIdentity('gw-1', 'tenant-1');
    const certificate = new SignedCertificate('CERT_PEM');
    const aeskey = new AESKey(Buffer.alloc(32, 5));

    const factoryValidator = {
      validate: jest.fn().mockResolvedValue(identity),
    };
    const csrSigner = { sign: jest.fn().mockResolvedValue(certificate) };
    const keyGenerator = { generate: jest.fn().mockReturnValue(aeskey) };
    const completer = { complete: jest.fn().mockResolvedValue(undefined) };
    const metrics = buildMetrics();

    const service = new ProvisioningService(
      factoryValidator as never,
      completer as never,
      csrSigner as never,
      keyGenerator as never,
      metrics as never,
    );

    const result = await service.onboard(buildRequest());

    expect(factoryValidator.validate).toHaveBeenCalledTimes(1);
    expect(csrSigner.sign).toHaveBeenCalledWith(
      expect.any(GatewayCSR),
      identity,
    );
    expect(keyGenerator.generate).toHaveBeenCalledTimes(1);
    expect(completer.complete).toHaveBeenCalledWith(
      identity,
      aeskey,
      5000,
      '1.2.3',
    );

    expect(metrics.provisioningAttempts.inc).toHaveBeenCalledTimes(1);
    expect(metrics.provisioningSuccesses.inc).toHaveBeenCalledTimes(1);
    expect(metrics.natsValidateDuration.observe).toHaveBeenCalledTimes(1);
    expect(metrics.csrSigningDuration.observe).toHaveBeenCalledTimes(1);
    expect(metrics.natsCompleteDuration.observe).toHaveBeenCalledTimes(1);

    expect(result.certificate).toBe(certificate);
    expect(result.aeskey).toBe(aeskey);
    expect(result.identity).toBe(identity);
    expect(result.sendFrequencyMs).toBe(5000);
  });

  it('propagates validation errors and marks failure reason', async () => {
    const factoryValidator = {
      validate: jest
        .fn()
        .mockRejectedValue(new InvalidFactoryCredentialsError()),
    };
    const csrSigner = { sign: jest.fn() };
    const keyGenerator = { generate: jest.fn() };
    const completer = { complete: jest.fn() };
    const metrics = buildMetrics();

    const service = new ProvisioningService(
      factoryValidator as never,
      completer as never,
      csrSigner as never,
      keyGenerator as never,
      metrics as never,
    );

    await expect(service.onboard(buildRequest())).rejects.toBeInstanceOf(
      InvalidFactoryCredentialsError,
    );

    expect(csrSigner.sign).not.toHaveBeenCalled();
    expect(keyGenerator.generate).not.toHaveBeenCalled();
    expect(completer.complete).not.toHaveBeenCalled();
    expect(metrics.provisioningFailures.labels).toHaveBeenCalledWith(
      'invalid_credentials',
    );
    expect(metrics.failureInc).toHaveBeenCalledTimes(1);
  });

  it('propagates CSR errors and marks malformed_csr failure', async () => {
    const identity = new GatewayIdentity('gw-1', 'tenant-1');
    const factoryValidator = {
      validate: jest.fn().mockResolvedValue(identity),
    };
    const csrSigner = {
      sign: jest.fn().mockRejectedValue(new MalformedCSRError()),
    };
    const keyGenerator = { generate: jest.fn() };
    const completer = { complete: jest.fn() };
    const metrics = buildMetrics();

    const service = new ProvisioningService(
      factoryValidator as never,
      completer as never,
      csrSigner as never,
      keyGenerator as never,
      metrics as never,
    );

    await expect(service.onboard(buildRequest())).rejects.toBeInstanceOf(
      MalformedCSRError,
    );

    expect(metrics.provisioningFailures.labels).toHaveBeenCalledWith(
      'malformed_csr',
    );
  });

  it('maps unexpected failures to generic error reason', async () => {
    const identity = new GatewayIdentity('gw-1', 'tenant-1');
    const factoryValidator = {
      validate: jest.fn().mockResolvedValue(identity),
    };
    const csrSigner = {
      sign: jest.fn().mockResolvedValue(new SignedCertificate('CERT')),
    };
    const keyGenerator = {
      generate: jest.fn().mockImplementation(() => {
        throw new Error('unexpected');
      }),
    };
    const completer = { complete: jest.fn() };
    const metrics = buildMetrics();

    const service = new ProvisioningService(
      factoryValidator as never,
      completer as never,
      csrSigner as never,
      keyGenerator as never,
      metrics as never,
    );

    await expect(service.onboard(buildRequest())).rejects.toThrow('unexpected');
    expect(metrics.provisioningFailures.labels).toHaveBeenCalledWith('error');
  });

  it('maps management API failures to service_unavailable reason', async () => {
    const identity = new GatewayIdentity('gw-1', 'tenant-1');
    const factoryValidator = {
      validate: jest
        .fn()
        .mockRejectedValue(new ManagementAPIUnavailableError()),
    };
    const csrSigner = { sign: jest.fn() };
    const keyGenerator = { generate: jest.fn() };
    const completer = { complete: jest.fn() };
    const metrics = buildMetrics();

    const service = new ProvisioningService(
      factoryValidator as never,
      completer as never,
      csrSigner as never,
      keyGenerator as never,
      metrics as never,
    );

    await expect(service.onboard(buildRequest())).rejects.toBeInstanceOf(
      ManagementAPIUnavailableError,
    );

    expect(metrics.provisioningFailures.labels).toHaveBeenCalledWith(
      'service_unavailable',
    );
  });

  it('maps non-Error failures to generic error reason', async () => {
    const identity = new GatewayIdentity('gw-1', 'tenant-1');
    const factoryValidator = {
      validate: jest.fn().mockResolvedValue(identity),
    };
    const csrSigner = {
      sign: jest.fn().mockResolvedValue(new SignedCertificate('CERT')),
    };
    const keyGenerator = {
      generate: jest.fn().mockImplementation(() => {
        throw 'boom';
      }),
    };
    const completer = { complete: jest.fn() };
    const metrics = buildMetrics();

    const service = new ProvisioningService(
      factoryValidator as never,
      completer as never,
      csrSigner as never,
      keyGenerator as never,
      metrics as never,
    );

    await expect(service.onboard(buildRequest())).rejects.toBe('boom');
    expect(metrics.provisioningFailures.labels).toHaveBeenCalledWith('error');
  });
});
