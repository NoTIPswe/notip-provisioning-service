import { IsString, IsNotEmpty } from 'class-validator';

export class OnboardRequestDto {
  @IsString()
  @IsNotEmpty()
  factory_id: string;

  @IsString()
  @IsNotEmpty()
  factory_key: string;

  @IsString()
  @IsNotEmpty()
  csr: string;
}
