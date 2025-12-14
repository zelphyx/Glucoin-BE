import { IsBoolean, IsNumber, IsOptional, IsObject, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

// Questionnaire for non-diabetic (screening)
export class QuestionnaireNonDiabeticDto {
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  penglihatan_buram: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  sering_bak: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  luka_lama_sembuh: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  kesemutan: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  obesitas: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  sering_lapar: boolean;

  @IsNumber()
  @Type(() => Number)
  @Min(20)
  @Max(300)
  berat_badan: number;

  @IsNumber()
  @Type(() => Number)
  @Min(100)
  @Max(250)
  tinggi_badan: number;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  riwayat_keluarga: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  tekanan_darah_tinggi: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  kolesterol_tinggi: boolean;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(3)
  frekuensi_olahraga: number; // 0=tidak pernah, 1=1-2x, 2=3-4x, 3=5+x seminggu

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(2)
  pola_makan: number; // 0=tinggi gula, 1=seimbang, 2=sehat
}

// Questionnaire for diabetic (monitoring)
export class QuestionnaireDiabeticDto {
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  peningkatan_bak: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  kesemutan: boolean;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(3)
  perubahan_berat: number; // 0=stabil, 1=naik sedikit, 2=turun drastis, 3=naik drastis

  @IsNumber()
  @Type(() => Number)
  @Min(50)
  @Max(500)
  gula_darah_puasa: number;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  rutin_hba1c: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(4)
  @Max(15)
  hasil_hba1c?: number;

  @IsNumber()
  @Type(() => Number)
  @Min(80)
  @Max(250)
  tekanan_darah_sistolik: number;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(2)
  kondisi_kolesterol: number; // 0=normal, 1=sedikit tinggi, 2=tinggi

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  konsumsi_obat: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  pernah_hipoglikemia: boolean;

  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  olahraga_rutin: boolean;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(2)
  pola_makan: number; // 0=tinggi gula, 1=terkontrol, 2=diet ketat
}

// Combined detection request
export class CombinedDetectionDto {
  @IsBoolean()
  is_diabetic: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  image_score?: number;

  @IsObject()
  questionnaire: Record<string, any>;
}

// Full screening questionnaire (same as non-diabetic but used with images)
export class FullScreeningDto {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  penglihatan_buram?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  sering_bak?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  luka_lama_sembuh?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  kesemutan?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  obesitas?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  sering_lapar?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  berat_badan?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  tinggi_badan?: number;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  riwayat_keluarga?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  tekanan_darah_tinggi?: boolean;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  kolesterol_tinggi?: boolean;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  frekuensi_olahraga?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  pola_makan?: number;
}
