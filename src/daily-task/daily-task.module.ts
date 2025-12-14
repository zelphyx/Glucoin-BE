import { Module } from '@nestjs/common';
import { DailyTaskController } from './daily-task.controller';
import { DailyTaskService } from './daily-task.service';
import { PrismaService } from '../prisma.service';
import { FonnteService } from '../reminder/fonnte.service';

@Module({
  controllers: [DailyTaskController],
  providers: [DailyTaskService, PrismaService, FonnteService],
  exports: [DailyTaskService],
})
export class DailyTaskModule {}
