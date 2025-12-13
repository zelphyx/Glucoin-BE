// src/reminder/reminder.service.ts
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FonnteService } from './fonnte.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  CreateReminderDto,
  UpdateReminderDto,
  CreateGlucoseLogDto,
  CreateMedicationLogDto,
  ReminderType,
} from './dto/reminder.dto';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private prisma: PrismaService,
    private fonnte: FonnteService,
  ) {}

  // ==================== REMINDER CRUD ====================

  async createReminder(userId: string, dto: CreateReminderDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Calculate next send time
    const nextSendAt = this.calculateNextSendTime(dto.time, dto.days);

    const reminder = await this.prisma.reminder.create({
      data: {
        user_id: userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        time: dto.time,
        days: dto.days,
        is_active: dto.is_active ?? true,
        next_send_at: nextSendAt,
      },
    });

    return {
      message: 'Reminder created successfully',
      reminder,
    };
  }

  async getUserReminders(userId: string) {
    return await this.prisma.reminder.findMany({
      where: { user_id: userId },
      orderBy: { time: 'asc' },
    });
  }

  async updateReminder(reminderId: string, userId: string, dto: UpdateReminderDto) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, user_id: userId },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    const nextSendAt = dto.time || dto.days
      ? this.calculateNextSendTime(dto.time || reminder.time, dto.days || reminder.days)
      : undefined;

    return await this.prisma.reminder.update({
      where: { id: reminderId },
      data: {
        ...dto,
        next_send_at: nextSendAt,
      },
    });
  }

  async deleteReminder(reminderId: string, userId: string) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, user_id: userId },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    await this.prisma.reminder.delete({ where: { id: reminderId } });

    return { message: 'Reminder deleted successfully' };
  }

  async toggleReminder(reminderId: string, userId: string, isActive: boolean) {
    const reminder = await this.prisma.reminder.findFirst({
      where: { id: reminderId, user_id: userId },
    });

    if (!reminder) {
      throw new NotFoundException('Reminder not found');
    }

    return await this.prisma.reminder.update({
      where: { id: reminderId },
      data: { is_active: isActive },
    });
  }

  // ==================== GLUCOSE LOG ====================

  async createGlucoseLog(userId: string, dto: CreateGlucoseLogDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Determine if glucose level is normal
    const targetMin = user.target_glucose_min || 70;
    const targetMax = user.target_glucose_max || 140;
    const isNormal = dto.glucose_level >= targetMin && dto.glucose_level <= targetMax;

    const log = await this.prisma.glucoseLog.create({
      data: {
        user_id: userId,
        glucose_level: dto.glucose_level,
        category: dto.category,
        measured_at: dto.measured_at || new Date(),
        notes: dto.notes,
        is_normal: isNormal,
      },
    });

    // Send alert if glucose is too high or too low
    if (user.whatsapp_number && user.is_reminder_active) {
      if (dto.glucose_level > 200) {
        await this.fonnte.sendHighGlucoseAlert(
          user.whatsapp_number,
          user.full_name,
          dto.glucose_level,
        );
      } else if (dto.glucose_level < 70) {
        await this.fonnte.sendLowGlucoseAlert(
          user.whatsapp_number,
          user.full_name,
          dto.glucose_level,
        );
      }
    }

    return {
      message: 'Glucose log created successfully',
      log,
      is_normal: isNormal,
      alert: dto.glucose_level > 200 ? 'HIGH' : dto.glucose_level < 70 ? 'LOW' : null,
    };
  }

  async getUserGlucoseLogs(
    userId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      category?: string;
      limit?: number;
    },
  ) {
    const where: any = { user_id: userId };

    if (options?.startDate || options?.endDate) {
      where.measured_at = {};
      if (options.startDate) where.measured_at.gte = options.startDate;
      if (options.endDate) where.measured_at.lte = options.endDate;
    }

    if (options?.category) {
      where.category = options.category;
    }

    const logs = await this.prisma.glucoseLog.findMany({
      where,
      orderBy: { measured_at: 'desc' },
      take: options?.limit || 100,
    });

    // Calculate statistics
    const glucoseLevels = logs.map((l) => l.glucose_level);
    const stats = {
      count: logs.length,
      average: glucoseLevels.length > 0
        ? Math.round(glucoseLevels.reduce((a, b) => a + b, 0) / glucoseLevels.length)
        : 0,
      min: glucoseLevels.length > 0 ? Math.min(...glucoseLevels) : 0,
      max: glucoseLevels.length > 0 ? Math.max(...glucoseLevels) : 0,
      in_range: logs.filter((l) => l.is_normal).length,
      above_range: logs.filter((l) => !l.is_normal && l.glucose_level > 140).length,
      below_range: logs.filter((l) => !l.is_normal && l.glucose_level < 70).length,
    };

    return { logs, stats };
  }

  async getGlucoseStatsByPeriod(userId: string, period: 'week' | 'month' | 'year') {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'week':
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'year':
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const logs = await this.prisma.glucoseLog.findMany({
      where: {
        user_id: userId,
        measured_at: { gte: startDate },
      },
      orderBy: { measured_at: 'asc' },
    });

    // Group by date for chart
    const groupedByDate: Record<string, number[]> = {};
    logs.forEach((log) => {
      const dateKey = log.measured_at.toISOString().split('T')[0];
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push(log.glucose_level);
    });

    const chartData = Object.entries(groupedByDate).map(([date, levels]) => ({
      date,
      average: Math.round(levels.reduce((a, b) => a + b, 0) / levels.length),
      min: Math.min(...levels),
      max: Math.max(...levels),
      count: levels.length,
    }));

    // Overall stats
    const allLevels = logs.map((l) => l.glucose_level);
    const overallStats = {
      total_readings: logs.length,
      average: allLevels.length > 0
        ? Math.round(allLevels.reduce((a, b) => a + b, 0) / allLevels.length)
        : 0,
      time_in_range: logs.length > 0
        ? Math.round((logs.filter((l) => l.is_normal).length / logs.length) * 100)
        : 0,
      lowest: allLevels.length > 0 ? Math.min(...allLevels) : 0,
      highest: allLevels.length > 0 ? Math.max(...allLevels) : 0,
    };

    return {
      period,
      start_date: startDate,
      end_date: now,
      stats: overallStats,
      chart_data: chartData,
    };
  }

  // ==================== MEDICATION LOG ====================

  async createMedicationLog(userId: string, dto: CreateMedicationLogDto) {
    const log = await this.prisma.medicationLog.create({
      data: {
        user_id: userId,
        medication_name: dto.medication_name,
        dosage: dto.dosage,
        taken_at: dto.taken_at || new Date(),
        notes: dto.notes,
      },
    });

    return {
      message: 'Medication log created successfully',
      log,
    };
  }

  async getUserMedicationLogs(userId: string, startDate?: Date, endDate?: Date) {
    const where: any = { user_id: userId };

    if (startDate || endDate) {
      where.taken_at = {};
      if (startDate) where.taken_at.gte = startDate;
      if (endDate) where.taken_at.lte = endDate;
    }

    return await this.prisma.medicationLog.findMany({
      where,
      orderBy: { taken_at: 'desc' },
    });
  }

  // ==================== CRON JOBS FOR REMINDERS ====================

  /**
   * Check and send reminders every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processReminders() {
    const now = new Date();
    
    // Get reminders that should be sent now
    const reminders = await this.prisma.reminder.findMany({
      where: {
        is_active: true,
        next_send_at: { lte: now },
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            whatsapp_number: true,
            is_reminder_active: true,
          },
        },
      },
    });

    for (const reminder of reminders) {
      // Skip if user has disabled reminders or no WhatsApp number
      if (!reminder.user.whatsapp_number || !reminder.user.is_reminder_active) {
        continue;
      }

      try {
        // Send reminder based on type
        switch (reminder.type) {
          case 'GLUCOSE_CHECK':
            await this.fonnte.sendGlucoseReminder(
              reminder.user.whatsapp_number,
              reminder.user.full_name,
            );
            break;
          case 'MEDICATION':
          case 'INSULIN':
            await this.fonnte.sendCustomReminder(
              reminder.user.whatsapp_number,
              reminder.user.full_name,
              reminder.title,
              reminder.message,
            );
            break;
          case 'EXERCISE':
            await this.fonnte.sendExerciseReminder(
              reminder.user.whatsapp_number,
              reminder.user.full_name,
            );
            break;
          default:
            await this.fonnte.sendCustomReminder(
              reminder.user.whatsapp_number,
              reminder.user.full_name,
              reminder.title,
              reminder.message,
            );
        }

        // Update reminder with last sent time and calculate next send
        const nextSendAt = this.calculateNextSendTime(reminder.time, reminder.days);
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: {
            last_sent_at: now,
            next_send_at: nextSendAt,
          },
        });

        this.logger.log(`✅ Reminder sent to ${reminder.user.full_name}: ${reminder.title}`);
      } catch (error) {
        this.logger.error(`❌ Failed to send reminder ${reminder.id}: ${error.message}`);
      }
    }
  }

  /**
   * Send daily summary at 9 PM
   */
  @Cron('0 21 * * *') // Every day at 9 PM
  async sendDailySummary() {
    const users = await this.prisma.user.findMany({
      where: {
        is_reminder_active: true,
        whatsapp_number: { not: null },
        role: 'USER',
      },
      select: {
        id: true,
        full_name: true,
        whatsapp_number: true,
        target_glucose_min: true,
        target_glucose_max: true,
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const user of users) {
      try {
        // Get today's glucose logs
        const logs = await this.prisma.glucoseLog.findMany({
          where: {
            user_id: user.id,
            measured_at: { gte: today },
          },
        });

        if (logs.length === 0) {
          // Remind to log if no logs today
          await this.fonnte.sendMessage(
            user.whatsapp_number!,
            `📊 *Ringkasan Harian*\n\nHalo ${user.full_name}!\n\nKamu belum mencatat gula darah hari ini. Jangan lupa untuk rutin cek dan catat ya! 🩸\n\n_Pesan otomatis dari Glucoin_`,
          );
        } else {
          const levels = logs.map((l) => l.glucose_level);
          const avg = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);
          const inRange = logs.filter((l) => l.is_normal).length;

          await this.fonnte.sendMessage(
            user.whatsapp_number!,
            `📊 *Ringkasan Harian*\n\nHalo ${user.full_name}!\n\nHasil pemantauan gula darah hari ini:\n📈 Rata-rata: *${avg} mg/dL*\n✅ Dalam target: ${inRange}/${logs.length} pengukuran\n🩸 Total cek: ${logs.length}x\n\n${avg > 140 ? '⚠️ Rata-rata di atas target, perhatikan pola makan!' : avg < 70 ? '⚠️ Rata-rata di bawah target, hati-hati hipoglikemia!' : '👏 Bagus! Pertahankan!'}\n\n_Pesan otomatis dari Glucoin_`,
          );
        }
      } catch (error) {
        this.logger.error(`Failed to send daily summary to ${user.id}: ${error.message}`);
      }
    }
  }

  // ==================== HELPER METHODS ====================

  private calculateNextSendTime(time: string, days: string[]): Date {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const next = new Date();

    next.setHours(hours, minutes, 0, 0);

    // If time has passed today, start from tomorrow
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    // If specific days, find next matching day
    if (!days.includes('EVERYDAY')) {
      const dayMap: Record<string, number> = {
        SUNDAY: 0,
        MONDAY: 1,
        TUESDAY: 2,
        WEDNESDAY: 3,
        THURSDAY: 4,
        FRIDAY: 5,
        SATURDAY: 6,
      };

      const targetDays = days.map((d) => dayMap[d]).filter((d) => d !== undefined);

      let found = false;
      for (let i = 0; i < 7 && !found; i++) {
        if (targetDays.includes(next.getDay())) {
          found = true;
        } else {
          next.setDate(next.getDate() + 1);
        }
      }
    }

    return next;
  }

  // ==================== DEFAULT REMINDERS SETUP ====================

  async setupDefaultReminders(userId: string) {
    const defaultReminders: CreateReminderDto[] = [
      {
        type: ReminderType.GLUCOSE_CHECK,
        title: 'Cek Gula Darah Pagi',
        message: 'Waktunya cek gula darah puasa!',
        time: '06:00',
        days: ['EVERYDAY'],
      },
      {
        type: ReminderType.GLUCOSE_CHECK,
        title: 'Cek Gula Darah Siang',
        message: 'Waktunya cek gula darah 2 jam setelah makan siang!',
        time: '14:00',
        days: ['EVERYDAY'],
      },
      {
        type: ReminderType.GLUCOSE_CHECK,
        title: 'Cek Gula Darah Malam',
        message: 'Waktunya cek gula darah sebelum tidur!',
        time: '21:00',
        days: ['EVERYDAY'],
      },
      {
        type: ReminderType.EXERCISE,
        title: 'Reminder Olahraga',
        message: 'Yuk olahraga minimal 30 menit!',
        time: '17:00',
        days: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
      },
    ];

    for (const reminder of defaultReminders) {
      await this.createReminder(userId, reminder);
    }

    return { message: 'Default reminders created successfully' };
  }
}
