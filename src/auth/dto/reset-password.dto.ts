import { IsNotEmpty, IsString, MinLength, IsBoolean } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;

  @IsBoolean()
  @IsNotEmpty({ message: 'You must confirm that you want to reset your password' })
  confirmReset: boolean;
}
