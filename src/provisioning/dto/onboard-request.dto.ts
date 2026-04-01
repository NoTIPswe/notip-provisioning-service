import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class FactoryCredentialsDto {
  @ApiProperty({
    description: 'Identificativo univoco del gateway (Opaque identifier)',
    example: 'GW-NOTIP-2026-001',
  })
  @IsString()
  @IsNotEmpty()
  factoryId: string;

  @ApiProperty({
    description:
      "Segreto monouso pre-condiviso per l'autenticazione in fabbrica",
    example: 'super-secret-factory-key',
    writeOnly: true,
  })
  @IsString()
  @IsNotEmpty()
  factoryKey: string;
}

export class OnboardRequestDto {
  @ApiProperty({
    description: 'Credenziali di fabbrica per autenticare il gateway',
    type: FactoryCredentialsDto,
  })
  @ValidateNested()
  @Type(() => FactoryCredentialsDto)
  credentials: FactoryCredentialsDto;

  @ApiProperty({
    description: 'Certificate Signing Request in formato PEM',
    example:
      '-----BEGIN CERTIFICATE REQUEST-----\nMIIB... \n-----END CERTIFICATE REQUEST-----',
  })
  @IsString()
  @IsNotEmpty()
  csr: string;

  @ApiProperty({
    type: 'integer',
    description: 'Frequenza di invio telemetria del gateway in millisecondi',
    example: 5000,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  sendFrequencyMs: number;

  @ApiProperty({
    description: 'Versione firmware del gateway',
    example: '1.0.0',
  })
  @IsString()
  @IsNotEmpty()
  firmwareVersion: string;
}
