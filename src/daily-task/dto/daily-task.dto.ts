import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  IsArray,
  IsDateString,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DailyTaskType {
  GLUCOSE_CHECK = 'GLUCOSE_CHECK',
  MEDICATION = 'MEDICATION',
  INSULIN = 'INSULIN',
  EXERCISE = 'EXERCISE',
  WATER_INTAKE = 'WATER_INTAKE',
  MEAL = 'MEAL',
  FOOT_CHECK = 'FOOT_CHECK',
  BLOOD_PRESSURE = 'BLOOD_PRESSURE',
  WEIGHT_CHECK = 'WEIGHT_CHECK',
  CUSTOM = 'CUSTOM',
}

// ==================== TEMPLATE DTOs ====================

export class CreateTaskTemplateDto {
  @ApiProperty({ example: 'Cek Gula Darah Pagi' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Cek gula darah puasa sebelum sarapan' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: DailyTaskType, example: DailyTaskType.GLUCOSE_CHECK })
  @IsEnum(DailyTaskType)
  task_type: DailyTaskType;

  @ApiProperty({ example: '06:00', description: 'Format HH:mm' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Time must be in HH:mm format',
  })
  time: string;

  @ApiProperty({
    example: ['EVERYDAY'],
    description: 'Array of days: MONDAY, TUESDAY, etc. or EVERYDAY',
  })
  @IsArray()
  @IsString({ each: true })
  days: string[];

  @ApiPropertyOptional({ example: 'Metformin' })
  @IsOptional()
  @IsString()
  medication_name?: string;

  @ApiPropertyOptional({ example: '500mg' })
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional({ example: 30, description: 'Target exercise minutes' })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(180)
  target_minutes?: number;

  @ApiPropertyOptional({ example: 8, description: 'Target glasses of water' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  target_glasses?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  send_reminder?: boolean;

  @ApiPropertyOptional({ default: 0, description: 'Minutes before to send reminder' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  reminder_minutes_before?: number;

  @ApiPropertyOptional({ example: '💊' })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: '#FF5722' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  priority?: number;
}

export class UpdateTaskTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  time?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  days?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  medication_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dosage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  target_minutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  target_glasses?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  send_reminder?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  reminder_minutes_before?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  priority?: number;
}

// ==================== DAILY TASK DTOs ====================

export class CompleteTaskDto {
  @ApiPropertyOptional({ example: 120, description: 'Glucose level in mg/dL' })
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(600)
  glucose_level?: number;

  @ApiPropertyOptional({ example: 30, description: 'Exercise duration in minutes' })
  @IsOptional()
  @IsInt()
  @Min(1)
  exercise_minutes?: number;

  @ApiPropertyOptional({ example: 8, description: 'Number of water glasses' })
  @IsOptional()
  @IsInt()
  @Min(1)
  water_glasses?: number;

  @ApiPropertyOptional({ example: 'Feeling good today!' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateManualTaskDto {
  @ApiProperty({ example: 'Beli obat di apotek' })
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: DailyTaskType, example: DailyTaskType.CUSTOM })
  @IsEnum(DailyTaskType)
  task_type: DailyTaskType;

  @ApiProperty({ example: '2024-12-15', description: 'Date in YYYY-MM-DD format' })
  @IsDateString()
  task_date: string;

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  scheduled_time?: string;
}
