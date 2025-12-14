import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';
import 'multer';

@Injectable()
export class DetectionService {
  private readonly aiApiUrl: string;

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.aiApiUrl = this.configService.get('GLUCOIN_AI_URL', 'https://glucoinai.mentorit.my.id');
  }

  // ==================== AI API CALLS ====================

  // Detect from single image (tongue/nail)
  async detectFromImage(
    file: Express.Multer.File,
    imageType: 'tongue' | 'nail',
  ) {
    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype,
    });

    const response = await firstValueFrom(
      this.httpService.post(
        `${this.aiApiUrl}/detection/detect/image?image_type=${imageType}`,
        formData,
        { headers: formData.getHeaders() },
      ),
    );

    return response.data;
  }

  // Detect from dual images (tongue + nail)
  async detectFromDualImage(
    tongueFile: Express.Multer.File,
    nailFile: Express.Multer.File,
  ) {
    const formData = new FormData();
    formData.append('tongue_image', tongueFile.buffer, {
      filename: tongueFile.originalname,
      contentType: tongueFile.mimetype,
    });
    formData.append('nail_image', nailFile.buffer, {
      filename: nailFile.originalname,
      contentType: nailFile.mimetype,
    });

    const response = await firstValueFrom(
      this.httpService.post(
        `${this.aiApiUrl}/detection/detect/dual-image`,
        formData,
        { headers: formData.getHeaders() },
      ),
    );

    return response.data;
  }

  // Questionnaire for non-diabetic
  async questionnaireNonDiabetic(data: any) {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.aiApiUrl}/detection/detect/questionnaire/non-diabetic`,
        data,
      ),
    );
    return response.data;
  }

  // Questionnaire for diabetic
  async questionnaireDiabetic(data: any) {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.aiApiUrl}/detection/detect/questionnaire/diabetic`,
        data,
      ),
    );
    return response.data;
  }

  // Combined detection (image + questionnaire)
  async detectCombined(data: {
    is_diabetic: boolean;
    image_score?: number;
    questionnaire: any;
  }) {
    const response = await firstValueFrom(
      this.httpService.post(
        `${this.aiApiUrl}/detection/detect/combined`,
        data,
      ),
    );
    return response.data;
  }

  // Full screening (tongue + nail + questionnaire)
  async fullScreening(
    tongueFile: Express.Multer.File,
    nailFile: Express.Multer.File,
    questionnaire: any,
  ) {
    const formData = new FormData();
    formData.append('tongue_image', tongueFile.buffer, {
      filename: tongueFile.originalname,
      contentType: tongueFile.mimetype,
    });
    formData.append('nail_image', nailFile.buffer, {
      filename: nailFile.originalname,
      contentType: nailFile.mimetype,
    });

    // Append questionnaire fields
    Object.entries(questionnaire).forEach(([key, value]) => {
      formData.append(key, String(value));
    });

    const response = await firstValueFrom(
      this.httpService.post(
        `${this.aiApiUrl}/detection/detect/full-screening`,
        formData,
        { headers: formData.getHeaders() },
      ),
    );

    return response.data;
  }

  // ==================== HISTORY MANAGEMENT ====================

  // Map risk level string to enum
  private mapRiskLevel(riskLevel: string): 'TIDAK' | 'RENDAH' | 'SEDANG' | 'TINGGI' {
    const mapping: Record<string, 'TIDAK' | 'RENDAH' | 'SEDANG' | 'TINGGI'> = {
      'tidak': 'TIDAK',
      'rendah': 'RENDAH',
      'sedang': 'SEDANG',
      'tinggi': 'TINGGI',
    };
    return mapping[riskLevel.toLowerCase()] || 'RENDAH';
  }

  // Save detection result to history
  saveDetectionHistory(
    userId: string,
    detectionType: 'IMAGE' | 'QUESTIONNAIRE' | 'COMBINED' | 'FULL_SCREENING',
    result: any,
    options?: {
      tongueImageUrl?: string;
      nailImageUrl?: string;
      questionnaireData?: any;
    },
  ) {
    const data: any = {
      user_id: userId,
      detection_type: detectionType,
      raw_response: result,
    };

    // Set based on detection type
    if (detectionType === 'IMAGE') {
      data.tongue_valid = result.is_valid_image && result.image_type === 'tongue';
      data.nail_valid = result.is_valid_image && result.image_type === 'nail';
      data.tongue_probability = result.image_type === 'tongue' ? result.probability : null;
      data.nail_probability = result.image_type === 'nail' ? result.probability : null;
      data.image_score = result.probability;
      data.final_score = result.probability || 0;
      data.risk_level = this.mapRiskLevel(result.risk_level || 'rendah');
      data.prediction = result.prediction || 'NON_DIABETES';
      data.interpretation = result.message || '';
      data.recommendations = [];
    } else if (detectionType === 'QUESTIONNAIRE') {
      data.questionnaire_data = options?.questionnaireData;
      data.questionnaire_score = result.score;
      data.final_score = result.score;
      data.risk_level = this.mapRiskLevel(result.risk_level);
      data.prediction = result.score >= 0.5 ? 'DIABETES' : 'NON_DIABETES';
      data.interpretation = result.interpretation;
      data.recommendations = result.recommendations || [];
    } else if (detectionType === 'COMBINED') {
      data.questionnaire_data = options?.questionnaireData;
      data.image_score = result.image_score;
      data.questionnaire_score = result.questionnaire_score;
      data.final_score = result.final_score;
      data.risk_level = this.mapRiskLevel(result.risk_level);
      data.prediction = result.final_score >= 0.5 ? 'DIABETES' : 'NON_DIABETES';
      data.interpretation = result.interpretation;
      data.recommendations = result.recommendations || [];
    } else if (detectionType === 'FULL_SCREENING') {
      data.tongue_image_url = options?.tongueImageUrl;
      data.nail_image_url = options?.nailImageUrl;
      data.tongue_valid = result.tongue_valid;
      data.tongue_probability = result.tongue_probability;
      data.nail_valid = result.nail_valid;
      data.nail_probability = result.nail_probability;
      data.image_score = result.image_score;
      data.questionnaire_data = options?.questionnaireData;
      data.questionnaire_score = result.questionnaire_score;
      data.final_score = result.final_score;
      data.risk_level = this.mapRiskLevel(result.risk_level);
      data.prediction = result.prediction;
      data.interpretation = result.interpretation;
      data.recommendations = result.recommendations || [];
    }

    return this.prisma.detectionHistory.create({
      data,
    });
  }

  // Get all detection history for a user
  async getDetectionHistory(
    userId: string,
    options?: {
      page?: number;
      limit?: number;
      type?: 'IMAGE' | 'QUESTIONNAIRE' | 'COMBINED' | 'FULL_SCREENING';
    },
  ) {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { user_id: userId };
    if (options?.type) {
      where.detection_type = options.type;
    }

    const [history, total] = await Promise.all([
      this.prisma.detectionHistory.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.detectionHistory.count({ where }),
    ]);

    return {
      data: history.map((h) => this.formatHistory(h)),
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  // Get latest detection for a user
  async getLatestDetection(userId: string) {
    const latest = await this.prisma.detectionHistory.findFirst({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    });

    if (!latest) {
      return null;
    }

    return this.formatHistory(latest);
  }

  // Get detection by ID
  async getDetectionById(id: string, userId: string) {
    const detection = await this.prisma.detectionHistory.findFirst({
      where: { id, user_id: userId },
    });

    if (!detection) {
      return null;
    }

    return this.formatHistory(detection);
  }

  // Format history for response
  private formatHistory(history: any) {
    return {
      id: history.id,
      detection_type: history.detection_type,
      tongue_image_url: history.tongue_image_url,
      nail_image_url: history.nail_image_url,
      tongue_valid: history.tongue_valid,
      tongue_probability: history.tongue_probability,
      nail_valid: history.nail_valid,
      nail_probability: history.nail_probability,
      image_score: history.image_score,
      questionnaire_score: history.questionnaire_score,
      final_score: history.final_score,
      risk_level: history.risk_level?.toLowerCase(),
      prediction: history.prediction,
      interpretation: history.interpretation,
      recommendations: history.recommendations,
      created_at: history.created_at,
    };
  }

  // Delete detection history
  async deleteDetection(id: string, userId: string) {
    const detection = await this.prisma.detectionHistory.findFirst({
      where: { id, user_id: userId },
    });

    if (!detection) {
      throw new BadRequestException('Detection not found');
    }

    await this.prisma.detectionHistory.delete({
      where: { id },
    });

    return { message: 'Detection history deleted' };
  }

  // Get detection statistics for a user
  async getDetectionStats(userId: string) {
    const [total, byRiskLevel, latestByType] = await Promise.all([
      this.prisma.detectionHistory.count({
        where: { user_id: userId },
      }),
      this.prisma.detectionHistory.groupBy({
        by: ['risk_level'],
        where: { user_id: userId },
        _count: true,
      }),
      this.prisma.detectionHistory.findMany({
        where: { user_id: userId },
        orderBy: { created_at: 'desc' },
        distinct: ['detection_type'],
        take: 4,
      }),
    ]);

    return {
      total_detections: total,
      by_risk_level: byRiskLevel.reduce((acc, item) => {
        acc[item.risk_level.toLowerCase()] = item._count;
        return acc;
      }, {} as Record<string, number>),
      latest_by_type: latestByType.map((h) => ({
        type: h.detection_type,
        risk_level: h.risk_level?.toLowerCase(),
        final_score: h.final_score,
        created_at: h.created_at,
      })),
    };
  }
}
