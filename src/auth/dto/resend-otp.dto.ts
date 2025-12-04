// src/auth/dto/resend-otp.dto.ts
import { IsEmail } from 'class-validator';

export class ResendOtpDto {
  @IsEmail()
  email: string;
}

