import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DetectionController } from './detection.controller';
import { DetectionService } from './detection.service';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [HttpModule],
  controllers: [DetectionController],
  providers: [DetectionService, PrismaService],
  exports: [DetectionService],
})
export class DetectionModule {}
