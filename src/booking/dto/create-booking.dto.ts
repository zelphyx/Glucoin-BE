import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsEnum,
  IsNumber,
  IsOptional,
  IsDateString,
  Matches,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ConsultationType {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
}

export class CreateBookingDto {
  @IsUUID()
  @IsNotEmpty()
  doctor_id: string;

  @IsUUID()
  @IsNotEmpty()
  schedule_id: string;

  @IsDateString()
  @IsNotEmpty()
  booking_date: string; // Format: "2025-12-18"

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'start_time must be in format HH:mm (e.g., 12:00)',
  })
  start_time: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'end_time must be in format HH:mm (e.g., 14:00)',
  })
  end_time: string;

  @IsNumber()
  @Min(15)
  @Type(() => Number)
  duration_minutes: number;

  @IsEnum(ConsultationType)
  consultation_type: ConsultationType;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  consultation_fee: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
