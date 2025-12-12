import { IsUUID, IsNotEmpty, IsString, IsOptional, IsNumber, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOrderDto {
  @IsUUID()
  @IsNotEmpty()
  shipping_address_id: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  shipping_cost: number;

  @IsString()
  @IsOptional()
  courier?: string; // JNE, JNT, SiCepat, dll

  @IsString()
  @IsOptional()
  notes?: string;
}

export enum ShippingStatus {
  NOT_SHIPPED = 'NOT_SHIPPED',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  IN_TRANSIT = 'IN_TRANSIT',
  DELIVERED = 'DELIVERED',
}

export class UpdateShippingDto {
  @IsString()
  @IsOptional()
  tracking_number?: string;

  @IsString()
  @IsOptional()
  courier?: string;

  @IsEnum(ShippingStatus)
  @IsOptional()
  shipping_status?: ShippingStatus;
}

export class ReviewProductDto {
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  rating: number; // 1-5

  @IsString()
  @IsOptional()
  comment?: string;
}
