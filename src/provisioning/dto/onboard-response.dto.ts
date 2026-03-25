import { ApiProperty } from '@nestjs/swagger';

export class OnboardResponseDto {
  @ApiProperty({
    description: 'Certificato foglia firmato dalla CA per il gateway (PEM)',
    example: '-----BEGIN CERTIFICATE-----\nMIID... \n-----END CERTIFICATE-----',
  })
  certificate: string;

  @ApiProperty({
    description: 'Chiave AES-256 generata casualmente, codificata in Base64',
    example: 'SGVsbG8gV29ybGQgQUVTLTI1NiBLZXk=',
  })
  aeskey: string;
}
