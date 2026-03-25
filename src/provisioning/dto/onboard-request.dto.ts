import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OnboardRequestDto {
  @ApiProperty({
    description: 'Identificativo univoco del gateway (Opaque identifier)',
    example: 'GW-NOTIP-2026-001',
  })
  @IsString()
  @IsNotEmpty()
  factory_id: string;

  @ApiProperty({
    description:
      "Segreto monouso pre-condiviso per l'autenticazione in fabbrica",
    example: 'super-secret-factory-key',
    writeOnly: true,
  })
  @IsString()
  @IsNotEmpty()
  factory_key: string;

  @ApiProperty({
    description: 'Certificate Signing Request in formato PEM',
    example:
      '-----BEGIN CERTIFICATE REQUEST-----\nMIIB... \n-----END CERTIFICATE REQUEST-----',
  })
  @IsString()
  @IsNotEmpty()
  csr: string;
}
