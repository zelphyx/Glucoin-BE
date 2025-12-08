import {
  IsString,
  IsBoolean,
  IsOptional,
  IsEnum,
  Matches,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DayOfWeek } from './create-doctor.dto';

export class ScheduleItemDto {
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

export class AddScheduleDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleItemDto)
  schedules: ScheduleItemDto[];
}

export class UpdateScheduleItemDto {
  @IsEnum(DayOfWeek)
  @IsOptional()
  day_of_week?: DayOfWeek;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'time_slot must be in format HH:mm (e.g., 09:00, 14:30)',
  })
  @IsOptional()
  time_slot?: string;

  @IsInt()
  @Min(15)
  @IsOptional()
  duration_minutes?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
