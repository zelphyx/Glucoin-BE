import {
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export class UpdateBookingDto {
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CancelBookingDto {
  @IsString()
  @IsOptional()
  cancellation_reason?: string;
}
