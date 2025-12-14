import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LabResultService } from './lab-result.service';

@ApiTags('Lab Results (OCR)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('lab-results')
export class LabResultController {
  constructor(private labResultService: LabResultService) {}

  @Post('scan')
  @ApiOperation({
    summary: 'Scan lab result photo using AI OCR',
    description: 'Upload a photo of lab results and extract values using Gemini Vision AI',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['image'],
      properties: {
        image: {
          type: 'string',
          format: 'binary',
          description: 'Lab result photo (JPG, PNG, WEBP)',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('image', {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB max
      },
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|webp|gif)$/)) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async scanLabResult(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    // For now, we'll use a placeholder URL
    // In production, you'd upload to cloud storage first
    const imageUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    return this.labResultService.extractAndSave(
      user.id,
      file.buffer,
      file.mimetype,
      imageUrl,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Get lab result history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getHistory(
    @CurrentUser() user: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.labResultService.getHistory(user.id, page, limit);
  }

  @Get('latest')
  @ApiOperation({ summary: 'Get latest lab result' })
  async getLatest(@CurrentUser() user: any) {
    return this.labResultService.getLatest(user.id);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get lab results summary with trends',
    description: 'Returns latest key metrics and historical trend data',
  })
  async getSummary(@CurrentUser() user: any) {
    return this.labResultService.getSummary(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get lab result by ID' })
  async getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.labResultService.getById(user.id, id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete lab result' })
  async delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.labResultService.delete(user.id, id);
  }
}
