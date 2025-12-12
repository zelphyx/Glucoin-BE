import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsUrl,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ProductCategory {
  SUPPLEMENT = 'SUPPLEMENT',
  MEDICINE = 'MEDICINE',
  MEDICAL_DEVICE = 'MEDICAL_DEVICE',
  FOOD_DRINK = 'FOOD_DRINK',
  OTHER = 'OTHER',
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  price: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  discount_percent?: number = 0;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity: number;

  @IsString()
  @IsUrl()
  @IsOptional()
  image_url?: string;

  @IsEnum(ProductCategory)
  category: ProductCategory;
}

export class UpdateProductDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  price?: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  discount_percent?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  quantity?: number;

  @IsString()
  @IsUrl()
  @IsOptional()
  image_url?: string;

  @IsEnum(ProductCategory)
  @IsOptional()
  category?: ProductCategory;

  @IsOptional()
  is_active?: boolean;
}
