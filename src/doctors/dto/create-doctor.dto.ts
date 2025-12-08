import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  IsEnum,
  Matches,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DayOfWeek {
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
  SUNDAY = 'SUNDAY',
}

export class CreateScheduleDto {
  @IsEnum(DayOfWeek)
  day_of_week: DayOfWeek;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'time_slot must be in format HH:mm (e.g., 09:00, 14:30)',
  })
  time_slot: string;

  @IsInt()
  @Min(15)
  @IsOptional()
  duration_minutes?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

export class CreateDoctorDto {
  @IsUUID()
  @IsNotEmpty()
  user_id: string;

  @IsString()
  @IsNotEmpty()
  specialization: string;

  @IsString()
  @IsNotEmpty()
  alamat_praktek: string;

  @IsString()
  @IsNotEmpty()
  price_range: string;

  @IsBoolean()
  @IsOptional()
  is_available?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateScheduleDto)
  @IsOptional()
  schedules?: CreateScheduleDto[];
}