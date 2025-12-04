// src/doctors/dto/update-doctor.dto.ts
// @ts-ignore
import { PartialType } from '@nestjs/mapped-types';
// @ts-ignore
import { CreateDoctorDto } from './create-doctor.dto';
// @ts-ignore
import { IsString, IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';
// @ts-ignore
import { Type } from 'class-transformer';

// @ts-ignore
export class UpdateDoctorDto extends PartialType(CreateDoctorDto) {
  @IsString()
  @IsOptional()
  specialization?: string;

  @IsString()
  @IsOptional()
  license_number?: string;

  @IsString()
  @IsOptional()
  qualifications?: string;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  years_of_experience?: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  consultation_fee_online?: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  consultation_fee_offline?: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(5)
  @IsOptional()
  rating?: number;

  @IsNumber()
  @Type(() => Number)
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
