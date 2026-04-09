import { ApiProperty } from '@nestjs/swagger';

export class GatewayIdentityDto {
  @ApiProperty({
    description: 'Identificativo univoco del gateway',
    example: 'gw-1',
  })
  gatewayId: string;

  @ApiProperty({
    description: 'Identificativo del tenant',
    example: 'tenant-1',
  })
  tenantId: string;
}

export class OnboardResponseDto {
  @ApiProperty({
    description: 'Certificato foglia firmato dalla CA per il gateway (PEM)',
    example: '-----BEGIN CERTIFICATE-----\nMIID... \n-----END CERTIFICATE-----',
  })
  certPem: string;

  @ApiProperty({
    description: 'Chiave AES-256 generata casualmente, codificata in Base64',
    example: 'SGVsbG8gV29ybGQgQUVTLTI1NiBLZXk=',
  })
  aesKey: string;

  @ApiProperty({
    description: 'Identita del gateway validata dal servizio di management',
    type: GatewayIdentityDto,
  })
  identity: GatewayIdentityDto;

  @ApiProperty({
    type: 'integer',
    description: 'Frequenza di invio telemetria del gateway in millisecondi',
    example: 5000,
    minimum: 1,
  })
  sendFrequencyMs: number;
}
