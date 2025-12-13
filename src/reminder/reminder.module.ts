// src/reminder/reminder.module.ts
import { Module } from '@nestjs/common';
import { ReminderController } from './reminder.controller';
import { ReminderService } from './reminder.service';
import { FonnteService } from './fonnte.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [ReminderController],
  providers: [ReminderService, FonnteService, PrismaService],
  exports: [ReminderService, FonnteService],
})
export class ReminderModule {}
