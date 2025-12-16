import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

export interface LabResultData {
  // Info Lab
  lab_name?: string;
  test_date?: string;

  // Gula Darah
  gdp?: number; // Gula Darah Puasa
  gdp_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';
  gd2pp?: number; // Gula Darah 2 Jam PP
  gd2pp_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';
  gds?: number; // Gula Darah Sewaktu
  gds_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';
  hba1c?: number;
  hba1c_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';

  // Profil Lipid
  cholesterol_total?: number;
  cholesterol_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';
  ldl?: number;
  ldl_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';
  hdl?: number;
  hdl_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';
  triglycerides?: number;
  triglycerides_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';

  // Fungsi Ginjal
  creatinine?: number;
  creatinine_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';
  urea?: number;
  urea_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';
  uric_acid?: number;
  uric_acid_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';

  // Fungsi Hati
  sgot?: number;
  sgot_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';
  sgpt?: number;
  sgpt_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';

  // Darah Lengkap
  hemoglobin?: number;
  hemoglobin_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';
  hematocrit?: number;
  hematocrit_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';
  leukocytes?: number;
  leukocytes_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';
  platelets?: number;
  platelets_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';
  erythrocytes?: number;
  erythrocytes_status?: 'NORMAL' | 'TINGGI' | 'RENDAH' | 'KRITIS';

  // Tekanan Darah
  blood_pressure_sys?: number;
  blood_pressure_dia?: number;

  // Metadata
  confidence_score?: number;
  raw_text?: string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not set. Lab OCR feature will not work.');
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash', // Best for vision/OCR tasks
    });
  }

  async extractLabResults(imageBuffer: Buffer, mimeType: string): Promise<LabResultData> {
    if (!this.model) {
      throw new Error('Gemini API not configured. Please set GEMINI_API_KEY.');
    }

    const prompt = `Kamu adalah AI ahli untuk membaca dan mengekstrak data dari foto hasil laboratorium medis Indonesia.

Analisis foto hasil lab ini dan ekstrak SEMUA nilai yang kamu temukan ke dalam format JSON.

PENTING:
1. Ekstrak SEMUA nilai numerik yang ada di foto
2. Tentukan status berdasarkan nilai rujukan standar:
   - NORMAL: dalam rentang normal
   - TINGGI: di atas nilai normal
   - RENDAH: di bawah nilai normal
   - KRITIS: sangat di luar rentang normal
3. Jika ada nilai yang tidak terbaca jelas, tetap coba ekstrak dengan best effort
4. Untuk tanggal, konversi ke format YYYY-MM-DD

Nilai rujukan standar Indonesia:
- GDP (Gula Darah Puasa): 70-100 mg/dL normal, 100-125 pre-diabetes, >126 diabetes
- GD2PP: <140 normal, 140-199 pre-diabetes, >=200 diabetes  
- GDS (Gula Darah Sewaktu): <200 normal
- HbA1c: <5.7% normal, 5.7-6.4% pre-diabetes, >=6.5% diabetes
- Kolesterol Total: <200 normal, 200-239 borderline, >=240 tinggi
- LDL: <100 optimal, 100-129 near optimal, 130-159 borderline high
- HDL: >60 optimal (protective), 40-60 normal, <40 risiko
- Trigliserida: <150 normal, 150-199 borderline, >=200 tinggi
- Kreatinin: Pria 0.7-1.3, Wanita 0.6-1.1 mg/dL
- Ureum/BUN: 7-20 mg/dL
- Asam Urat: Pria 3.4-7.0, Wanita 2.4-6.0 mg/dL
- SGOT: 5-40 U/L
- SGPT: 7-56 U/L
- Hemoglobin: Pria 13.5-17.5, Wanita 12.0-16.0 g/dL
- Hematokrit: Pria 38-50%, Wanita 36-44%
- Leukosit: 4.5-11.0 ribu/uL
- Trombosit: 150-400 ribu/uL
- Eritrosit: Pria 4.5-5.5, Wanita 4.0-5.0 juta/uL
- Tekanan Darah: <120/80 normal, 120-129/<80 elevated, >=130/>=80 hipertensi

Format output JSON:
{
  "lab_name": "string atau null",
  "test_date": "YYYY-MM-DD atau null",
  "gdp": number atau null,
  "gdp_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "gd2pp": number atau null,
  "gd2pp_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "gds": number atau null,
  "gds_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "hba1c": number atau null,
  "hba1c_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "cholesterol_total": number atau null,
  "cholesterol_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "ldl": number atau null,
  "ldl_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "hdl": number atau null,
  "hdl_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "triglycerides": number atau null,
  "triglycerides_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "creatinine": number atau null,
  "creatinine_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "urea": number atau null,
  "urea_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "uric_acid": number atau null,
  "uric_acid_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "sgot": number atau null,
  "sgot_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "sgpt": number atau null,
  "sgpt_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "hemoglobin": number atau null,
  "hemoglobin_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "hematocrit": number atau null,
  "hematocrit_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "leukocytes": number atau null,
  "leukocytes_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "platelets": number atau null,
  "platelets_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "erythrocytes": number atau null,
  "erythrocytes_status": "NORMAL/TINGGI/RENDAH/KRITIS atau null",
  "blood_pressure_sys": number atau null,
  "blood_pressure_dia": number atau null,
  "confidence_score": number 0-1,
  "raw_text": "teks mentah yang terbaca dari foto"
}

HANYA RETURN JSON OBJECT, TANPA MARKDOWN CODE BLOCK ATAU TEKS LAIN.`;

    try {
      const result = await this.model.generateContent([
        {
          inlineData: {
            mimeType: mimeType,
            data: imageBuffer.toString('base64'),
          },
        },
        prompt,
      ]);

      const response = result.response;
      const text = response.text();

      this.logger.debug('Gemini raw response:', text);

      // Parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse JSON from Gemini response');
      }

      const parsed = JSON.parse(jsonMatch[0]) as LabResultData;
      return parsed;
    } catch (error: any) {
      this.logger.error('Error extracting lab results:', error);
      
      // Handle quota exceeded error
      if (error?.status === 429) {
        throw new Error('Gemini API quota exceeded. Please try again later or contact support.');
      }
      
      // Handle API key error
      if (error?.status === 400 || error?.status === 403) {
        throw new Error('Gemini API key is invalid or not authorized.');
      }
      
      throw error;
    }
  }
}
