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
  async onboard(
    @Body() body: OnboardRequestDto,
    @Req() req: Request,
  ): Promise<OnboardResponseDto> {
    const credentials = new FactoryCredentials(
      body.factory_id,
      body.factory_key,
    );
    const csr = new GatewayCSR(body.csr);
    const request = new ProvisioningRequest(
      credentials,
      csr,
      body.send_frequency_ms,
    );

    const result = await this.provisioningService.onboard(request);

    req.provisioningResult = result;

    return {
      certificate: result.certificate.pemData,
      aeskey: result.aeskey.toBase64(),
      send_frequency_ms: result.sendFrequencyMs,
    };
  }
}
