import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateShippingAddressDto {
  @IsString()
  @IsNotEmpty()
  recipient_name: string;

  @IsString()
  @IsNotEmpty()
  phone_number: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  province: string;

  @IsString()
  @IsNotEmpty()
  postal_code: string;

  @IsBoolean()
  @IsOptional()
  is_default?: boolean = false;
}

export class UpdateShippingAddressDto {
  @IsString()
  @IsOptional()
  recipient_name?: string;

  @IsString()
  @IsOptional()
  phone_number?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  province?: string;

  @IsString()
  @IsOptional()
  postal_code?: string;

  @IsBoolean()
  @IsOptional()
  is_default?: boolean;
}
