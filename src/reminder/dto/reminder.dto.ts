// src/reminder/dto/reminder.dto.ts
import { IsString, IsOptional, IsBoolean, IsInt, IsEnum, IsDateString, IsArray, Min, Max, Matches } from 'class-validator';

export enum ReminderType {
  GLUCOSE_CHECK = 'GLUCOSE_CHECK',
  MEDICATION = 'MEDICATION',
  INSULIN = 'INSULIN',
  EXERCISE = 'EXERCISE',
  APPOINTMENT = 'APPOINTMENT',
  CUSTOM = 'CUSTOM',
}

export enum GlucoseCategory {
  FASTING = 'FASTING',
  BEFORE_MEAL = 'BEFORE_MEAL',
  AFTER_MEAL = 'AFTER_MEAL',
  RANDOM = 'RANDOM',
  BEDTIME = 'BEDTIME',
}

export enum DiabetesType {
  TYPE_1 = 'TYPE_1',
  TYPE_2 = 'TYPE_2',
  GESTATIONAL = 'GESTATIONAL',
  PRE_DIABETES = 'PRE_DIABETES',
}

// ==================== REMINDER DTOs ====================

export class CreateReminderDto {
  @IsEnum(ReminderType)
  type: ReminderType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Time must be in HH:mm format',
  })
  time: string; // Format: "HH:mm"

  @IsArray()
  @IsString({ each: true })
  days: string[]; // ["MONDAY", "TUESDAY", ...] atau ["EVERYDAY"]

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class UpdateReminderDto {
  @IsOptional()
  @IsEnum(ReminderType)
  type?: ReminderType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Time must be in HH:mm format',
  })
  time?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  days?: string[];

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

// ==================== GLUCOSE LOG DTOs ====================

export class CreateGlucoseLogDto {
  @IsInt()
  @Min(20)
  @Max(600)
  glucose_level: number; // mg/dL

  @IsEnum(GlucoseCategory)
  category: GlucoseCategory;

  @IsOptional()
  @IsDateString()
  measured_at?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ==================== MEDICATION LOG DTOs ====================

export class CreateMedicationLogDto {
  @IsString()
  medication_name: string;

  @IsString()
  dosage: string;

  @IsOptional()
  @IsDateString()
  taken_at?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ==================== USER DIABETES PROFILE DTOs ====================

export class UpdateDiabetesProfileDto {
  @IsOptional()
  @IsEnum(DiabetesType)
  diabetes_type?: DiabetesType;

  @IsOptional()
  @IsDateString()
  diagnosis_date?: string;

  @IsOptional()
  @IsInt()
  @Min(50)
  @Max(200)
  target_glucose_min?: number;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(300)
  target_glucose_max?: number;

  @IsOptional()
  @IsBoolean()
  is_on_insulin?: boolean;

  @IsOptional()
  @IsBoolean()
  is_reminder_active?: boolean;
}
