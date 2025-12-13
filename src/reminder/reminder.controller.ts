// src/reminder/reminder.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Patch,
} from '@nestjs/common';
import { ReminderService } from './reminder.service';
import { FonnteService } from './fonnte.service';
import {
  CreateReminderDto,
  UpdateReminderDto,
  CreateGlucoseLogDto,
  CreateMedicationLogDto,
  UpdateDiabetesProfileDto,
} from './dto/reminder.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma.service';

@Controller('health')
@UseGuards(JwtAuthGuard)
export class ReminderController {
  constructor(
    private readonly reminderService: ReminderService,
    private readonly fonnteService: FonnteService,
    private readonly prisma: PrismaService,
  ) {}

  // ==================== REMINDERS ====================

  @Post('reminders')
  createReminder(@CurrentUser() user: any, @Body() dto: CreateReminderDto) {
    return this.reminderService.createReminder(user.id, dto);
  }

  @Get('reminders')
  getMyReminders(@CurrentUser() user: any) {
    return this.reminderService.getUserReminders(user.id);
  }

  @Put('reminders/:id')
  updateReminder(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateReminderDto,
  ) {
    return this.reminderService.updateReminder(id, user.id, dto);
  }

  @Delete('reminders/:id')
  deleteReminder(@CurrentUser() user: any, @Param('id') id: string) {
    return this.reminderService.deleteReminder(id, user.id);
  }

  @Patch('reminders/:id/toggle')
  toggleReminder(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('is_active') isActive: boolean,
  ) {
    return this.reminderService.toggleReminder(id, user.id, isActive);
  }

  @Post('reminders/setup-default')
  setupDefaultReminders(@CurrentUser() user: any) {
    return this.reminderService.setupDefaultReminders(user.id);
  }

  // ==================== GLUCOSE LOGS ====================

  @Post('glucose')
  createGlucoseLog(@CurrentUser() user: any, @Body() dto: CreateGlucoseLogDto) {
    return this.reminderService.createGlucoseLog(user.id, dto);
  }

  @Get('glucose')
  getMyGlucoseLogs(
    @CurrentUser() user: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reminderService.getUserGlucoseLogs(user.id, {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      category,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('glucose/stats')
  getGlucoseStats(
    @CurrentUser() user: any,
    @Query('period') period: 'week' | 'month' | 'year' = 'week',
  ) {
    return this.reminderService.getGlucoseStatsByPeriod(user.id, period);
  }

  // ==================== MEDICATION LOGS ====================

  @Post('medication')
  createMedicationLog(@CurrentUser() user: any, @Body() dto: CreateMedicationLogDto) {
    return this.reminderService.createMedicationLog(user.id, dto);
  }

  @Get('medication')
  getMyMedicationLogs(
    @CurrentUser() user: any,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reminderService.getUserMedicationLogs(
      user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  // ==================== DIABETES PROFILE ====================

  @Get('profile')
  async getMyDiabetesProfile(@CurrentUser() user: any) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        full_name: true,
        date_of_birth: true,
        gender: true,
        weight_kg: true,
        height_cm: true,
        golongan_darah: true,
        tekanan_darah: true,
        alergi: true,
        whatsapp_number: true,
        diabetes_type: true,
        diagnosis_date: true,
        target_glucose_min: true,
        target_glucose_max: true,
        hba1c_target: true,
        last_hba1c: true,
        last_hba1c_date: true,
        is_on_insulin: true,
        is_reminder_active: true,
      },
    });

    return profile;
  }

  @Put('profile')
  async updateDiabetesProfile(
    @CurrentUser() user: any,
    @Body() dto: UpdateDiabetesProfileDto,
  ) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        diabetes_type: dto.diabetes_type,
        diagnosis_date: dto.diagnosis_date ? new Date(dto.diagnosis_date) : undefined,
        target_glucose_min: dto.target_glucose_min,
        target_glucose_max: dto.target_glucose_max,
        is_on_insulin: dto.is_on_insulin,
        is_reminder_active: dto.is_reminder_active,
      },
      select: {
        id: true,
        diabetes_type: true,
        diagnosis_date: true,
        target_glucose_min: true,
        target_glucose_max: true,
        is_on_insulin: true,
        is_reminder_active: true,
      },
    });

    return {
      message: 'Diabetes profile updated successfully',
      profile: updated,
    };
  }

  // ==================== DASHBOARD ====================

  @Get('dashboard')
  async getHealthDashboard(@CurrentUser() user: any) {
    const [profile, glucoseStats, recentLogs, reminders] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: user.id },
        select: {
          full_name: true,
          diabetes_type: true,
          target_glucose_min: true,
          target_glucose_max: true,
          is_on_insulin: true,
        },
      }),
      this.reminderService.getGlucoseStatsByPeriod(user.id, 'week'),
      this.reminderService.getUserGlucoseLogs(user.id, { limit: 5 }),
      this.reminderService.getUserReminders(user.id),
    ]);

    // Get today's logs
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogs = await this.prisma.glucoseLog.findMany({
      where: {
        user_id: user.id,
        measured_at: { gte: today },
      },
      orderBy: { measured_at: 'desc' },
    });

    return {
      user: profile,
      today: {
        readings: todayLogs.length,
        logs: todayLogs,
        average: todayLogs.length > 0
          ? Math.round(todayLogs.reduce((a, b) => a + b.glucose_level, 0) / todayLogs.length)
          : null,
      },
      weekly_stats: glucoseStats.stats,
      recent_logs: recentLogs.logs,
      active_reminders: reminders.filter((r) => r.is_active).length,
    };
  }

  // ==================== TEST NOTIFICATION ====================

  @Post('test-notification')
  async testNotification(@CurrentUser() user: any) {
    const userData = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { whatsapp_number: true, full_name: true },
    });

    if (!userData?.whatsapp_number) {
      return { success: false, message: 'WhatsApp number not set' };
    }

    const result = await this.fonnteService.sendMessage(
      userData.whatsapp_number,
      `🔔 *Test Notification*\n\nHalo ${userData.full_name}!\n\nIni adalah pesan test dari Glucoin. Jika kamu menerima pesan ini, berarti notifikasi WhatsApp kamu sudah aktif! ✅\n\n_Pesan otomatis dari Glucoin_`,
    );

    return {
      success: result.status,
      message: result.status ? 'Test notification sent!' : `Failed: ${result.detail}`,
    };
  }
}
