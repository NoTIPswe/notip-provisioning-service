import {
  Inject,
  Controller,
  Post,
  HttpCode,
  Body,
  Req,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { ApiResponse, ApiBody } from '@nestjs/swagger';
import type { Request } from 'express';
import type { OnboardGateway } from './interfaces/onboard-gateway.interface';
import { FactoryCredentials } from './model/factory-credentials';
import { GatewayCSR } from './model/gateway-csr';
import { ProvisioningRequest } from './model/provisioning-request';
import { ProvisioningResult } from './model/provisioning-result';
import { OnboardRequestDto } from './dto/onboard-request.dto';
import { OnboardResponseDto } from './dto/onboard-response.dto';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { ProvisioningExceptionFilter } from './provisioning-exception.filter';

declare module 'express' {
  interface Request {
    provisioningResult?: ProvisioningResult;
  }
}

@Controller('provision')
@UseInterceptors(AuditLogInterceptor)
@UseFilters(ProvisioningExceptionFilter)
export class ProvisioningController {
  constructor(
    @Inject('OnboardGateway')
    private readonly provisioningService: OnboardGateway,
  ) {}

  @Post('onboard')
  @HttpCode(201)
  @ApiBody({
    type: OnboardRequestDto,
    description: 'Gateway onboard request with factory credentials and CSR',
  })
  @ApiResponse({
    status: 201,
    description: 'Gateway provisioned successfully',
    type: OnboardResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request - malformed CSR or missing required fields',
  })
  @ApiResponse({
    status: 409,
    description: 'Conflict - gateway already provisioned',
  })
  @ApiResponse({
    status: 500,
    description: 'Server error - CA or NATS service unavailable',
  })
  async onboard(
    @Body() body: OnboardRequestDto,
    @Req() req: Request,
  ): Promise<OnboardResponseDto> {
    const credentials = new FactoryCredentials(
      body.credentials.factoryId,
      body.credentials.factoryKey,
    );
    const csr = new GatewayCSR(body.csr);
    const request = new ProvisioningRequest(
      credentials,
      csr,
      body.sendFrequencyMs,
      body.firmwareVersion,
    );

    const result = await this.provisioningService.onboard(request);

    req.provisioningResult = result;

    return {
      certPem: result.certificate.pemData,
      aesKey: result.aeskey.toBase64(),
      identity: {
        gatewayId: result.identity.gatewayId,
        tenantId: result.identity.tenantId,
      },
      sendFrequencyMs: result.sendFrequencyMs,
    };
  }
}
