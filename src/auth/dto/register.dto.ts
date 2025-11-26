// src/auth/dto/register.dto.ts
// @ts-ignore
import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  full_name: string;

  @IsEnum(['ADMIN', 'USER', 'DOCTOR'])
  role: 'ADMIN' | 'USER' | 'DOCTOR';

  @IsOptional()
  @IsString()
  phone_number?: string;
}
