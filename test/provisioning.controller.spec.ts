import { ProvisioningController } from '../src/provisioning/provisioning.controller';
import { OnboardRequestDto } from '../src/provisioning/dto/onboard-request.dto';
import type { Request } from 'express';
import type { OnboardGateway } from '../src/provisioning/interfaces/onboard-gateway.interface';
import { ProvisioningRequest } from '../src/provisioning/model/provisioning-request';
import { ProvisioningResult } from '../src/provisioning/model/provisioning-result';
import { MalformedCSRError } from '../src/provisioning/model/errors';
import { SignedCertificate } from '../src/ca/model/signed-certificate';
import { AESKey } from '../src/provisioning/model/aes-key';
import { GatewayIdentity } from '../src/provisioning/model/gateway-identity';

describe('ProvisioningController', () => {
  it('maps request DTO to domain request and returns mapped response', async () => {
    const result = new ProvisioningResult(
      new SignedCertificate('CERT_PEM'),
      new AESKey(Buffer.alloc(32, 7)),
      new GatewayIdentity('gw-1', 'tenant-1'),
    );

    let capturedRequest: ProvisioningRequest | undefined;
    const onboardMock = jest.fn((request: ProvisioningRequest) => {
      capturedRequest = request;
      return Promise.resolve(result);
    });

    const gateway: OnboardGateway = {
      onboard: onboardMock,
    };

    const controller = new ProvisioningController(gateway);

    const body: OnboardRequestDto = {
      factory_id: 'factory-1',
      factory_key: 'secret-1',
      csr: '-----BEGIN CERTIFICATE REQUEST-----\nabc',
    };

    const req = {} as Request;
    const response = await controller.onboard(body, req);

    expect(onboardMock).toHaveBeenCalledTimes(1);
    expect(capturedRequest).toBeDefined();
    expect(capturedRequest?.credentials.factoryId).toBe('factory-1');
    expect(capturedRequest?.credentials.factoryKey).toBe('secret-1');
    expect(capturedRequest?.csr.pemData).toBe(body.csr);

    expect(req.provisioningResult).toBe(result);
    expect(response).toEqual({
      certificate: 'CERT_PEM',
      aesKey: result.aesKey.toBase64(),
    });
  });

  it('propagates MalformedCSRError and does not invoke service for invalid CSR', async () => {
    const onboardMock = jest.fn();
    const gateway: OnboardGateway = {
      onboard: onboardMock,
    };

    const controller = new ProvisioningController(gateway);

    const body: OnboardRequestDto = {
      factory_id: 'factory-1',
      factory_key: 'secret-1',
      csr: 'invalid-csr',
    };

    const req = {} as Request;

    await expect(controller.onboard(body, req)).rejects.toBeInstanceOf(
      MalformedCSRError,
    );

    expect(onboardMock).not.toHaveBeenCalled();
  });
});
