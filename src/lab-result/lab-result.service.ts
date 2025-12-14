import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { GeminiService, LabResultData } from './gemini.service';
import { LabStatus } from '@glucoin/prisma';

@Injectable()
export class LabResultService {
  private readonly logger = new Logger(LabResultService.name);

  constructor(
    private prisma: PrismaService,
    private geminiService: GeminiService,
  ) {}

  async extractAndSave(
    userId: string,
    imageBuffer: Buffer,
    mimeType: string,
    imageUrl: string,
  ) {
    // Extract lab results using Gemini Vision
    const extractedData = await this.geminiService.extractLabResults(
      imageBuffer,
      mimeType,
    );

    this.logger.log('Extracted lab data:', JSON.stringify(extractedData));

    // Map status strings to enum
    const mapStatus = (
      status?: string,
    ): LabStatus | null => {
      if (!status) return null;
      const statusMap: Record<string, LabStatus> = {
        NORMAL: 'NORMAL',
        TINGGI: 'TINGGI',
        RENDAH: 'RENDAH',
        KRITIS: 'KRITIS',
      };
      return statusMap[status] || null;
    };

    // Parse test date if present
    let testDate: Date | null = null;
    if (extractedData.test_date) {
      try {
        testDate = new Date(extractedData.test_date);
        if (isNaN(testDate.getTime())) {
          testDate = null;
        }
      } catch {
        testDate = null;
      }
    }

    // Save to database
    const labResult = await this.prisma.labResult.create({
      data: {
        user_id: userId,
        image_url: imageUrl,
        lab_name: extractedData.lab_name || null,
        test_date: testDate,

        // Gula Darah
        gdp: extractedData.gdp || null,
        gdp_status: mapStatus(extractedData.gdp_status),
        gd2pp: extractedData.gd2pp || null,
        gd2pp_status: mapStatus(extractedData.gd2pp_status),
        gds: extractedData.gds || null,
        gds_status: mapStatus(extractedData.gds_status),
        hba1c: extractedData.hba1c || null,
        hba1c_status: mapStatus(extractedData.hba1c_status),

        // Profil Lipid
        cholesterol_total: extractedData.cholesterol_total || null,
        cholesterol_status: mapStatus(extractedData.cholesterol_status),
        ldl: extractedData.ldl || null,
        ldl_status: mapStatus(extractedData.ldl_status),
        hdl: extractedData.hdl || null,
        hdl_status: mapStatus(extractedData.hdl_status),
        triglycerides: extractedData.triglycerides || null,
        triglycerides_status: mapStatus(extractedData.triglycerides_status),

        // Fungsi Ginjal
        creatinine: extractedData.creatinine || null,
        creatinine_status: mapStatus(extractedData.creatinine_status),
        urea: extractedData.urea || null,
        urea_status: mapStatus(extractedData.urea_status),
        uric_acid: extractedData.uric_acid || null,
        uric_acid_status: mapStatus(extractedData.uric_acid_status),

        // Fungsi Hati
        sgot: extractedData.sgot || null,
        sgot_status: mapStatus(extractedData.sgot_status),
        sgpt: extractedData.sgpt || null,
        sgpt_status: mapStatus(extractedData.sgpt_status),

        // Darah Lengkap
        hemoglobin: extractedData.hemoglobin || null,
        hemoglobin_status: mapStatus(extractedData.hemoglobin_status),
        hematocrit: extractedData.hematocrit || null,
        hematocrit_status: mapStatus(extractedData.hematocrit_status),
        leukocytes: extractedData.leukocytes || null,
        leukocytes_status: mapStatus(extractedData.leukocytes_status),
        platelets: extractedData.platelets || null,
        platelets_status: mapStatus(extractedData.platelets_status),
        erythrocytes: extractedData.erythrocytes || null,
        erythrocytes_status: mapStatus(extractedData.erythrocytes_status),

        // Tekanan Darah
        blood_pressure_sys: extractedData.blood_pressure_sys || null,
        blood_pressure_dia: extractedData.blood_pressure_dia || null,

        // Metadata
        raw_extracted_data: extractedData as object,
        confidence_score: extractedData.confidence_score || null,
      },
    });

    return {
      status: 'ok',
      message: 'Lab result extracted and saved successfully',
      data: this.formatLabResult(labResult),
    };
  }

  async getHistory(userId: string, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [results, total] = await Promise.all([
      this.prisma.labResult.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.labResult.count({
        where: { user_id: userId },
      }),
    ]);

    return {
      status: 'ok',
      data: results.map((r) => this.formatLabResult(r)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(userId: string, id: string) {
    const result = await this.prisma.labResult.findFirst({
      where: {
        id,
        user_id: userId,
      },
    });

    if (!result) {
      throw new NotFoundException('Lab result not found');
    }

    return {
      status: 'ok',
      data: this.formatLabResult(result),
    };
  }

  async getLatest(userId: string) {
    const result = await this.prisma.labResult.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    if (!result) {
      return {
        status: 'ok',
        data: null,
        message: 'No lab results found',
      };
    }

    return {
      status: 'ok',
      data: this.formatLabResult(result),
    };
  }

  async delete(userId: string, id: string) {
    const result = await this.prisma.labResult.findFirst({
      where: {
        id,
        user_id: userId,
      },
    });

    if (!result) {
      throw new NotFoundException('Lab result not found');
    }

    await this.prisma.labResult.delete({
      where: { id },
    });

    return {
      status: 'ok',
      message: 'Lab result deleted successfully',
    };
  }

  async getSummary(userId: string) {
    // Get latest values for key metrics
    const latest = await this.prisma.labResult.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    if (!latest) {
      return {
        status: 'ok',
        data: null,
        message: 'No lab results found',
      };
    }

    // Get historical trend (last 6 results for key metrics)
    const history = await this.prisma.labResult.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: 6,
      select: {
        id: true,
        test_date: true,
        created_at: true,
        gdp: true,
        gd2pp: true,
        hba1c: true,
        cholesterol_total: true,
      },
    });

    return {
      status: 'ok',
      data: {
        latest: {
          // Gula Darah
          gdp: latest.gdp
            ? { value: latest.gdp, status: latest.gdp_status }
            : null,
          gd2pp: latest.gd2pp
            ? { value: latest.gd2pp, status: latest.gd2pp_status }
            : null,
          gds: latest.gds
            ? { value: latest.gds, status: latest.gds_status }
            : null,
          hba1c: latest.hba1c
            ? { value: latest.hba1c, status: latest.hba1c_status }
            : null,

          // Lipid
          cholesterol_total: latest.cholesterol_total
            ? {
                value: latest.cholesterol_total,
                status: latest.cholesterol_status,
              }
            : null,
          ldl: latest.ldl
            ? { value: latest.ldl, status: latest.ldl_status }
            : null,
          hdl: latest.hdl
            ? { value: latest.hdl, status: latest.hdl_status }
            : null,
          triglycerides: latest.triglycerides
            ? { value: latest.triglycerides, status: latest.triglycerides_status }
            : null,

          // Ginjal
          creatinine: latest.creatinine
            ? { value: latest.creatinine, status: latest.creatinine_status }
            : null,
          uric_acid: latest.uric_acid
            ? { value: latest.uric_acid, status: latest.uric_acid_status }
            : null,
        },
        trend: history.reverse().map((h) => ({
          date: h.test_date || h.created_at,
          gdp: h.gdp,
          gd2pp: h.gd2pp,
          hba1c: h.hba1c,
          cholesterol_total: h.cholesterol_total,
        })),
        last_updated: latest.created_at,
      },
    };
  }

  private formatLabResult(result: any) {
    return {
      id: result.id,
      image_url: result.image_url,
      lab_name: result.lab_name,
      test_date: result.test_date,

      gula_darah: {
        gdp: result.gdp
          ? { value: result.gdp, status: result.gdp_status, unit: 'mg/dL' }
          : null,
        gd2pp: result.gd2pp
          ? { value: result.gd2pp, status: result.gd2pp_status, unit: 'mg/dL' }
          : null,
        gds: result.gds
          ? { value: result.gds, status: result.gds_status, unit: 'mg/dL' }
          : null,
        hba1c: result.hba1c
          ? { value: result.hba1c, status: result.hba1c_status, unit: '%' }
          : null,
      },

      profil_lipid: {
        cholesterol_total: result.cholesterol_total
          ? {
              value: result.cholesterol_total,
              status: result.cholesterol_status,
              unit: 'mg/dL',
            }
          : null,
        ldl: result.ldl
          ? { value: result.ldl, status: result.ldl_status, unit: 'mg/dL' }
          : null,
        hdl: result.hdl
          ? { value: result.hdl, status: result.hdl_status, unit: 'mg/dL' }
          : null,
        triglycerides: result.triglycerides
          ? {
              value: result.triglycerides,
              status: result.triglycerides_status,
              unit: 'mg/dL',
            }
          : null,
      },

      fungsi_ginjal: {
        creatinine: result.creatinine
          ? {
              value: result.creatinine,
              status: result.creatinine_status,
              unit: 'mg/dL',
            }
          : null,
        urea: result.urea
          ? { value: result.urea, status: result.urea_status, unit: 'mg/dL' }
          : null,
        uric_acid: result.uric_acid
          ? {
              value: result.uric_acid,
              status: result.uric_acid_status,
              unit: 'mg/dL',
            }
          : null,
      },

      fungsi_hati: {
        sgot: result.sgot
          ? { value: result.sgot, status: result.sgot_status, unit: 'U/L' }
          : null,
        sgpt: result.sgpt
          ? { value: result.sgpt, status: result.sgpt_status, unit: 'U/L' }
          : null,
      },

      darah_lengkap: {
        hemoglobin: result.hemoglobin
          ? {
              value: result.hemoglobin,
              status: result.hemoglobin_status,
              unit: 'g/dL',
            }
          : null,
        hematocrit: result.hematocrit
          ? {
              value: result.hematocrit,
              status: result.hematocrit_status,
              unit: '%',
            }
          : null,
        leukocytes: result.leukocytes
          ? {
              value: result.leukocytes,
              status: result.leukocytes_status,
              unit: 'ribu/uL',
            }
          : null,
        platelets: result.platelets
          ? {
              value: result.platelets,
              status: result.platelets_status,
              unit: 'ribu/uL',
            }
          : null,
        erythrocytes: result.erythrocytes
          ? {
              value: result.erythrocytes,
              status: result.erythrocytes_status,
              unit: 'juta/uL',
            }
          : null,
      },

      tekanan_darah:
        result.blood_pressure_sys && result.blood_pressure_dia
          ? {
              systolic: result.blood_pressure_sys,
              diastolic: result.blood_pressure_dia,
              display: `${result.blood_pressure_sys}/${result.blood_pressure_dia} mmHg`,
            }
          : null,

      confidence_score: result.confidence_score,
      created_at: result.created_at,
      updated_at: result.updated_at,
    };
  }
}
