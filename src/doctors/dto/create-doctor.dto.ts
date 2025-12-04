import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsUUID,
  Min,
  Max,
  IsDecimal,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDoctorDto {

  @IsUUID()
  @IsString()
  user_id: string;

  @IsString()
  @IsNotEmpty()
  specialization: string;

  @IsString()
  @IsNotEmpty()
  license_number: string;

  @IsString()
  @IsNotEmpty()
  qualifications: string;

  @IsNumber()
  @IsNotEmpty()
  years_of_experience: number;

  @IsDecimal()
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  consultation_fee_online?: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsDecimal()
  @Min(0)
  @IsOptional()
  consultation_fee_offline?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  total_patients?: number;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsBoolean()
  @IsOptional()
  is_available?: boolean;
}