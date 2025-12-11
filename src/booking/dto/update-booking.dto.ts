import {
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';

export enum BookingStatus {
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  EXPIRED = 'EXPIRED',
  REFUNDED = 'REFUNDED',
}

export class UpdateBookingDto {
  @IsEnum(BookingStatus)
  @IsOptional()
  status?: BookingStatus;

  @IsEnum(PaymentStatus)
  @IsOptional()
  payment_status?: PaymentStatus;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CancelBookingDto {
  @IsString()
  @IsOptional()
  cancellation_reason?: string;
}
