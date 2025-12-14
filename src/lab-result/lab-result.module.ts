import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { GeminiService } from './gemini.service';
import { LabResultService } from './lab-result.service';
import { LabResultController } from './lab-result.controller';

@Module({
  imports: [ConfigModule],
  controllers: [LabResultController],
  providers: [PrismaService, GeminiService, LabResultService],
  exports: [LabResultService, GeminiService],
})
export class LabResultModule {}
