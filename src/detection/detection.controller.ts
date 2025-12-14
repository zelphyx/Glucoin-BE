import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import 'multer';
import { DetectionService } from './detection.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  QuestionnaireNonDiabeticDto,
  QuestionnaireDiabeticDto,
  CombinedDetectionDto,
  FullScreeningDto,
} from './dto/detection.dto';

@Controller('detection')
@UseGuards(JwtAuthGuard)
export class DetectionController {
  constructor(private readonly detectionService: DetectionService) {}

  // ==================== DETECTION ENDPOINTS ====================

  // Detect from single image (tongue or nail)
  @Post('image')
  @UseInterceptors(FileInterceptor('file'))
  async detectFromImage(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Query('image_type') imageType: 'tongue' | 'nail' = 'tongue',
  ) {
    const result = await this.detectionService.detectFromImage(file, imageType);

    // Save to history if successful
    if (result.success) {
      await this.detectionService.saveDetectionHistory(user.id, 'IMAGE', result);
    }

    return result;
  }

  // Detect from dual images (tongue + nail)
  @Post('dual-image')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'tongue_image', maxCount: 1 },
      { name: 'nail_image', maxCount: 1 },
    ]),
  )
  async detectFromDualImage(
    @CurrentUser() user: any,
    @UploadedFiles()
    files: {
      tongue_image?: Express.Multer.File[];
      nail_image?: Express.Multer.File[];
    },
  ) {
    const tongueFile = files.tongue_image?.[0];
    const nailFile = files.nail_image?.[0];

    if (!tongueFile || !nailFile) {
      return { success: false, message: 'Both tongue and nail images are required' };
    }

    const result = await this.detectionService.detectFromDualImage(tongueFile, nailFile);

    // Save to history
    if (result.success || result.tongue_valid || result.nail_valid) {
      await this.detectionService.saveDetectionHistory(user.id, 'IMAGE', {
        ...result,
        is_valid_image: result.tongue_valid || result.nail_valid,
        probability: result.combined_probability,
      });
    }

    return result;
  }

  // Questionnaire for non-diabetic (screening)
  @Post('questionnaire/non-diabetic')
  async questionnaireNonDiabetic(
    @CurrentUser() user: any,
    @Body() data: QuestionnaireNonDiabeticDto,
  ) {
    const result = await this.detectionService.questionnaireNonDiabetic(data);

    // Save to history
    if (result.success) {
      await this.detectionService.saveDetectionHistory(
        user.id,
        'QUESTIONNAIRE',
        result,
        { questionnaireData: data },
      );
    }

    return result;
  }

  // Questionnaire for diabetic (monitoring)
  @Post('questionnaire/diabetic')
  async questionnaireDiabetic(
    @CurrentUser() user: any,
    @Body() data: QuestionnaireDiabeticDto,
  ) {
    const result = await this.detectionService.questionnaireDiabetic(data);

    // Save to history
    if (result.success) {
      await this.detectionService.saveDetectionHistory(
        user.id,
        'QUESTIONNAIRE',
        result,
        { questionnaireData: data },
      );
    }

    return result;
  }

  // Combined detection (image score + questionnaire)
  @Post('combined')
  async detectCombined(
    @CurrentUser() user: any,
    @Body() data: CombinedDetectionDto,
  ) {
    const result = await this.detectionService.detectCombined({
      is_diabetic: data.is_diabetic,
      image_score: data.image_score,
      questionnaire: data.questionnaire,
    });

    // Save to history
    if (result.success) {
      await this.detectionService.saveDetectionHistory(
        user.id,
        'COMBINED',
        result,
        { questionnaireData: data.questionnaire },
      );
    }

    return result;
  }

  // Full screening (tongue + nail + questionnaire)
  @Post('full-screening')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'tongue_image', maxCount: 1 },
      { name: 'nail_image', maxCount: 1 },
    ]),
  )
  async fullScreening(
    @CurrentUser() user: any,
    @UploadedFiles()
    files: {
      tongue_image?: Express.Multer.File[];
      nail_image?: Express.Multer.File[];
    },
    @Body() questionnaire: FullScreeningDto,
  ) {
    const tongueFile = files.tongue_image?.[0];
    const nailFile = files.nail_image?.[0];

    if (!tongueFile || !nailFile) {
      return { success: false, message: 'Both tongue and nail images are required' };
    }

    const result = await this.detectionService.fullScreening(
      tongueFile,
      nailFile,
      questionnaire,
    );

    // Save to history
    if (result.success) {
      await this.detectionService.saveDetectionHistory(
        user.id,
        'FULL_SCREENING',
        result,
        { questionnaireData: questionnaire },
      );
    }

    return result;
  }

  // ==================== HISTORY ENDPOINTS ====================

  // Get all detection history
  @Get('history')
  async getHistory(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: 'IMAGE' | 'QUESTIONNAIRE' | 'COMBINED' | 'FULL_SCREENING',
  ) {
    return this.detectionService.getDetectionHistory(user.id, {
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      type,
    });
  }

  // Get latest detection
  @Get('history/latest')
  async getLatestDetection(@CurrentUser() user: any) {
    const latest = await this.detectionService.getLatestDetection(user.id);
    if (!latest) {
      return { message: 'No detection history found', data: null };
    }
    return latest;
  }

  // Get detection statistics
  @Get('history/stats')
  async getStats(@CurrentUser() user: any) {
    return this.detectionService.getDetectionStats(user.id);
  }

  // Get detection by ID
  @Get('history/:id')
  async getDetectionById(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    const detection = await this.detectionService.getDetectionById(id, user.id);
    if (!detection) {
      return { message: 'Detection not found', data: null };
    }
    return detection;
  }

  // Delete detection history
  @Delete('history/:id')
  async deleteDetection(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.detectionService.deleteDetection(id, user.id);
  }
}
