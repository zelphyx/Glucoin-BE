import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { FonnteService } from '../reminder/fonnte.service';
import { Cron } from '@nestjs/schedule';
import { GlucoseCategory } from '@glucoin/prisma';
import {
  CreateTaskTemplateDto,
  UpdateTaskTemplateDto,
  CompleteTaskDto,
  CreateManualTaskDto,
  DailyTaskType,
} from './dto/daily-task.dto';

@Injectable()
export class DailyTaskService {
  private readonly logger = new Logger(DailyTaskService.name);

  constructor(
    private prisma: PrismaService,
    private fonnte: FonnteService,
  ) {}

  // ==================== TEMPLATE MANAGEMENT ====================

  async createTemplate(userId: string, dto: CreateTaskTemplateDto) {
    const template = await this.prisma.dailyTaskTemplate.create({
      data: {
        user_id: userId,
        title: dto.title,
        description: dto.description,
        task_type: dto.task_type,
        time: dto.time,
        days: dto.days,
        medication_name: dto.medication_name,
        dosage: dto.dosage,
        target_minutes: dto.target_minutes,
        target_glasses: dto.target_glasses,
        is_active: dto.is_active ?? true,
        send_reminder: dto.send_reminder ?? true,
        reminder_minutes_before: dto.reminder_minutes_before ?? 0,
        icon: dto.icon || this.getDefaultIcon(dto.task_type),
        color: dto.color || this.getDefaultColor(dto.task_type),
        priority: dto.priority ?? 0,
      },
    });

    return {
      status: 'ok',
      message: 'Task template created successfully',
      data: template,
    };
  }

  async getTemplates(userId: string) {
    const templates = await this.prisma.dailyTaskTemplate.findMany({
      where: { user_id: userId },
      orderBy: [{ priority: 'desc' }, { time: 'asc' }],
    });

    return {
      status: 'ok',
      data: templates,
    };
  }

  async updateTemplate(userId: string, templateId: string, dto: UpdateTaskTemplateDto) {
    const template = await this.prisma.dailyTaskTemplate.findFirst({
      where: { id: templateId, user_id: userId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const updated = await this.prisma.dailyTaskTemplate.update({
      where: { id: templateId },
      data: dto,
    });

    return {
      status: 'ok',
      message: 'Template updated successfully',
      data: updated,
    };
  }

  async deleteTemplate(userId: string, templateId: string) {
    const template = await this.prisma.dailyTaskTemplate.findFirst({
      where: { id: templateId, user_id: userId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await this.prisma.dailyTaskTemplate.delete({
      where: { id: templateId },
    });

    return {
      status: 'ok',
      message: 'Template deleted successfully',
    };
  }

  async toggleTemplate(userId: string, templateId: string, isActive: boolean) {
    const template = await this.prisma.dailyTaskTemplate.findFirst({
      where: { id: templateId, user_id: userId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    const updated = await this.prisma.dailyTaskTemplate.update({
      where: { id: templateId },
      data: { is_active: isActive },
    });

    return {
      status: 'ok',
      message: `Template ${isActive ? 'activated' : 'deactivated'}`,
      data: updated,
    };
  }

  // ==================== DAILY TASKS ====================

  async getTodayTasks(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Generate tasks from templates if not exist
    await this.generateDailyTasks(userId, today);

    // Get all tasks for today
    const tasks = await this.prisma.dailyTask.findMany({
      where: {
        user_id: userId,
        task_date: {
          gte: today,
          lt: tomorrow,
        },
      },
      orderBy: [{ scheduled_time: 'asc' }, { created_at: 'asc' }],
      include: {
        template: {
          select: {
            icon: true,
            color: true,
          },
        },
      },
    });

    // Calculate progress
    const total = tasks.length;
    const completed = tasks.filter((t) => t.is_completed).length;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      status: 'ok',
      data: {
        date: today.toISOString().split('T')[0],
        progress: {
          total,
          completed,
          remaining: total - completed,
          percentage: progress,
        },
        tasks: tasks.map((t) => this.formatTask(t)),
      },
    };
  }

  async getTasksByDate(userId: string, date: string) {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Generate tasks if it's today or future
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (targetDate >= today) {
      await this.generateDailyTasks(userId, targetDate);
    }

    const tasks = await this.prisma.dailyTask.findMany({
      where: {
        user_id: userId,
        task_date: {
          gte: targetDate,
          lt: nextDay,
        },
      },
      orderBy: [{ scheduled_time: 'asc' }, { created_at: 'asc' }],
      include: {
        template: {
          select: {
            icon: true,
            color: true,
          },
        },
      },
    });

    const total = tasks.length;
    const completed = tasks.filter((t) => t.is_completed).length;

    return {
      status: 'ok',
      data: {
        date: targetDate.toISOString().split('T')[0],
        progress: {
          total,
          completed,
          remaining: total - completed,
          percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
        },
        tasks: tasks.map((t) => this.formatTask(t)),
      },
    };
  }

  async completeTask(userId: string, taskId: string, dto: CompleteTaskDto) {
    const task = await this.prisma.dailyTask.findFirst({
      where: { id: taskId, user_id: userId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const updated = await this.prisma.dailyTask.update({
      where: { id: taskId },
      data: {
        is_completed: true,
        completed_at: new Date(),
        glucose_level: dto.glucose_level,
        exercise_minutes: dto.exercise_minutes,
        water_glasses: dto.water_glasses,
        notes: dto.notes,
      },
      include: {
        template: {
          select: {
            icon: true,
            color: true,
          },
        },
      },
    });

    // If glucose check, also create glucose log
    if (task.task_type === 'GLUCOSE_CHECK' && dto.glucose_level) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      const targetMin = user?.target_glucose_min || 70;
      const targetMax = user?.target_glucose_max || 140;
      const isNormal = dto.glucose_level >= targetMin && dto.glucose_level <= targetMax;

      await this.prisma.glucoseLog.create({
        data: {
          user_id: userId,
          glucose_level: dto.glucose_level,
          category: this.mapTimeToCategory(task.scheduled_time),
          measured_at: new Date(),
          notes: dto.notes,
          is_normal: isNormal,
        },
      });

      // Send alert if abnormal
      if (user?.whatsapp_number && user.is_reminder_active) {
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
    }

    return {
      status: 'ok',
      message: 'Task completed!',
      data: this.formatTask(updated),
    };
  }

  async uncompleteTask(userId: string, taskId: string) {
    const task = await this.prisma.dailyTask.findFirst({
      where: { id: taskId, user_id: userId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const updated = await this.prisma.dailyTask.update({
      where: { id: taskId },
      data: {
        is_completed: false,
        completed_at: null,
        glucose_level: null,
        exercise_minutes: null,
        water_glasses: null,
      },
      include: {
        template: {
          select: {
            icon: true,
            color: true,
          },
        },
      },
    });

    return {
      status: 'ok',
      message: 'Task unmarked',
      data: this.formatTask(updated),
    };
  }

  async createManualTask(userId: string, dto: CreateManualTaskDto) {
    const taskDate = new Date(dto.task_date);
    taskDate.setHours(0, 0, 0, 0);

    const task = await this.prisma.dailyTask.create({
      data: {
        user_id: userId,
        title: dto.title,
        description: dto.description,
        task_type: dto.task_type,
        task_date: taskDate,
        scheduled_time: dto.scheduled_time,
      },
    });

    return {
      status: 'ok',
      message: 'Manual task created',
      data: this.formatTask(task),
    };
  }

  async deleteTask(userId: string, taskId: string) {
    const task = await this.prisma.dailyTask.findFirst({
      where: { id: taskId, user_id: userId },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    await this.prisma.dailyTask.delete({
      where: { id: taskId },
    });

    return {
      status: 'ok',
      message: 'Task deleted',
    };
  }

  // ==================== STATISTICS ====================

  async getWeeklyProgress(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const tasks = await this.prisma.dailyTask.findMany({
      where: {
        user_id: userId,
        task_date: {
          gte: weekAgo,
          lte: today,
        },
      },
    });

    // Group by date
    const byDate: Record<string, { total: number; completed: number }> = {};

    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      byDate[dateKey] = { total: 0, completed: 0 };
    }

    tasks.forEach((task) => {
      const dateKey = task.task_date.toISOString().split('T')[0];
      if (byDate[dateKey]) {
        byDate[dateKey].total++;
        if (task.is_completed) {
          byDate[dateKey].completed++;
        }
      }
    });

    const chartData = Object.entries(byDate).map(([date, data]) => ({
      date,
      total: data.total,
      completed: data.completed,
      percentage: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }));

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.is_completed).length;

    return {
      status: 'ok',
      data: {
        summary: {
          total: totalTasks,
          completed: completedTasks,
          percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
        },
        chart: chartData,
      },
    };
  }

  async getStreak(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentStreak = 0;
    let checkDate = new Date(today);

    // Count consecutive days with 100% completion
    while (true) {
      const nextDay = new Date(checkDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const tasks = await this.prisma.dailyTask.findMany({
        where: {
          user_id: userId,
          task_date: {
            gte: checkDate,
            lt: nextDay,
          },
        },
      });

      if (tasks.length === 0) {
        // No tasks for this day, check if it's today
        if (checkDate.getTime() === today.getTime()) {
          checkDate.setDate(checkDate.getDate() - 1);
          continue;
        }
        break;
      }

      const allCompleted = tasks.every((t) => t.is_completed);
      if (!allCompleted) break;

      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    return {
      status: 'ok',
      data: {
        current_streak: currentStreak,
        message: currentStreak > 0
          ? `🔥 ${currentStreak} hari berturut-turut! Pertahankan!`
          : 'Mulai streak kamu hari ini!',
      },
    };
  }

  // ==================== DEFAULT TEMPLATES ====================

  async setupDefaultTemplates(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    const defaults: CreateTaskTemplateDto[] = [
      {
        title: 'Cek Gula Darah Pagi',
        description: 'Cek gula darah puasa sebelum sarapan',
        task_type: DailyTaskType.GLUCOSE_CHECK,
        time: '06:00',
        days: ['EVERYDAY'],
        icon: '🩸',
        color: '#E53935',
        priority: 10,
      },
      {
        title: 'Cek Gula Darah Siang',
        description: '2 jam setelah makan siang',
        task_type: DailyTaskType.GLUCOSE_CHECK,
        time: '14:00',
        days: ['EVERYDAY'],
        icon: '🩸',
        color: '#E53935',
        priority: 8,
      },
      {
        title: 'Cek Gula Darah Malam',
        description: 'Sebelum tidur',
        task_type: DailyTaskType.GLUCOSE_CHECK,
        time: '21:00',
        days: ['EVERYDAY'],
        icon: '🩸',
        color: '#E53935',
        priority: 6,
      },
      {
        title: 'Minum Air Putih',
        description: 'Minimal 8 gelas per hari',
        task_type: DailyTaskType.WATER_INTAKE,
        time: '08:00',
        days: ['EVERYDAY'],
        target_glasses: 8,
        icon: '💧',
        color: '#2196F3',
        priority: 5,
      },
      {
        title: 'Olahraga 30 Menit',
        description: 'Jalan kaki, senam, atau olahraga ringan',
        task_type: DailyTaskType.EXERCISE,
        time: '17:00',
        days: ['MONDAY', 'WEDNESDAY', 'FRIDAY', 'SATURDAY'],
        target_minutes: 30,
        icon: '🏃',
        color: '#4CAF50',
        priority: 7,
      },
      {
        title: 'Cek Kondisi Kaki',
        description: 'Periksa luka, bengkak, atau perubahan warna',
        task_type: DailyTaskType.FOOT_CHECK,
        time: '21:30',
        days: ['EVERYDAY'],
        icon: '🦶',
        color: '#FF9800',
        priority: 4,
      },
    ];

    // Add insulin reminder if user uses insulin
    if (user?.is_on_insulin) {
      defaults.push({
        title: 'Suntik Insulin Pagi',
        description: 'Sebelum sarapan',
        task_type: DailyTaskType.INSULIN,
        time: '06:30',
        days: ['EVERYDAY'],
        icon: '💉',
        color: '#9C27B0',
        priority: 9,
      });
      defaults.push({
        title: 'Suntik Insulin Malam',
        description: 'Sebelum makan malam',
        task_type: DailyTaskType.INSULIN,
        time: '18:00',
        days: ['EVERYDAY'],
        icon: '💉',
        color: '#9C27B0',
        priority: 9,
      });
    }

    // Create templates
    for (const template of defaults) {
      // Check if similar template exists
      const existing = await this.prisma.dailyTaskTemplate.findFirst({
        where: {
          user_id: userId,
          task_type: template.task_type,
          time: template.time,
        },
      });

      if (!existing) {
        await this.createTemplate(userId, template);
      }
    }

    return {
      status: 'ok',
      message: 'Default templates created',
    };
  }

  // ==================== CRON JOBS ====================

  /**
   * Generate daily tasks at midnight
   */
  @Cron('0 0 * * *') // Every day at midnight
  async generateAllUsersTasks() {
    this.logger.log('🔄 Generating daily tasks for all users...');

    const users = await this.prisma.user.findMany({
      where: {
        role: 'USER',
        is_reminder_active: true,
      },
      select: { id: true },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const user of users) {
      try {
        await this.generateDailyTasks(user.id, today);
      } catch (error) {
        this.logger.error(`Failed to generate tasks for user ${user.id}: ${error.message}`);
      }
    }

    this.logger.log(`✅ Generated tasks for ${users.length} users`);
  }

  /**
   * Send task reminders every 15 minutes
   */
  @Cron('*/15 * * * *') // Every 15 minutes
  async sendTaskReminders() {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get tasks that need reminders
    const tasks = await this.prisma.dailyTask.findMany({
      where: {
        task_date: {
          gte: today,
          lt: tomorrow,
        },
        is_completed: false,
        reminder_sent: false,
        scheduled_time: { not: null },
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
        template: {
          select: {
            send_reminder: true,
            reminder_minutes_before: true,
          },
        },
      },
    });

    for (const task of tasks) {
      if (!task.user.whatsapp_number || !task.user.is_reminder_active) continue;
      if (task.template && !task.template.send_reminder) continue;

      // Parse scheduled time
      const [hours, minutes] = (task.scheduled_time || '00:00').split(':').map(Number);
      const scheduledTime = new Date(today);
      scheduledTime.setHours(hours, minutes, 0, 0);

      // Calculate when to send (considering reminder_minutes_before)
      const reminderBefore = task.template?.reminder_minutes_before || 0;
      const sendTime = new Date(scheduledTime);
      sendTime.setMinutes(sendTime.getMinutes() - reminderBefore);

      // Check if it's time to send (within 15 minute window)
      const timeDiff = (sendTime.getTime() - now.getTime()) / (1000 * 60);

      if (timeDiff <= 0 && timeDiff > -15) {
        try {
          await this.sendTaskReminder(task);

          await this.prisma.dailyTask.update({
            where: { id: task.id },
            data: {
              reminder_sent: true,
              reminder_sent_at: now,
            },
          });

          this.logger.log(`✅ Reminder sent for task: ${task.title} to ${task.user.full_name}`);
        } catch (error) {
          this.logger.error(`Failed to send reminder: ${error.message}`);
        }
      }
    }
  }

  /**
   * Send end of day summary at 9 PM
   */
  @Cron('0 21 * * *')
  async sendDailyTaskSummary() {
    const users = await this.prisma.user.findMany({
      where: {
        role: 'USER',
        is_reminder_active: true,
        whatsapp_number: { not: null },
      },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const user of users) {
      try {
        const tasks = await this.prisma.dailyTask.findMany({
          where: {
            user_id: user.id,
            task_date: {
              gte: today,
              lt: tomorrow,
            },
          },
        });

        if (tasks.length === 0) continue;

        const completed = tasks.filter((t) => t.is_completed).length;
        const total = tasks.length;
        const percentage = Math.round((completed / total) * 100);

        const remaining = tasks.filter((t) => !t.is_completed);

        let message = `📋 *Ringkasan Task Harian*\n\nHalo ${user.full_name}!\n\n`;
        message += `✅ Progress: ${completed}/${total} task (${percentage}%)\n\n`;

        if (remaining.length > 0) {
          message += `⏳ *Belum selesai:*\n`;
          remaining.forEach((t) => {
            message += `• ${t.title}\n`;
          });
          message += `\nYuk selesaikan sebelum tidur! 💪`;
        } else {
          message += `🎉 *Luar biasa!* Semua task hari ini sudah selesai!\n\nPertahankan konsistensimu! 🔥`;
        }

        message += `\n\n_Pesan otomatis dari Glucoin_`;

        await this.fonnte.sendMessage(user.whatsapp_number!, message);
      } catch (error) {
        this.logger.error(`Failed to send summary to ${user.id}: ${error.message}`);
      }
    }
  }

  // ==================== HELPER METHODS ====================

  private async generateDailyTasks(userId: string, date: Date) {
    const dayOfWeek = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][
      date.getDay()
    ];

    // Get active templates for this day
    const templates = await this.prisma.dailyTaskTemplate.findMany({
      where: {
        user_id: userId,
        is_active: true,
        OR: [
          { days: { has: dayOfWeek } },
          { days: { has: 'EVERYDAY' } },
        ],
      },
    });

    // Create tasks from templates (upsert to avoid duplicates)
    for (const template of templates) {
      await this.prisma.dailyTask.upsert({
        where: {
          user_id_template_id_task_date: {
            user_id: userId,
            template_id: template.id,
            task_date: date,
          },
        },
        create: {
          user_id: userId,
          template_id: template.id,
          title: template.title,
          description: template.description,
          task_type: template.task_type,
          task_date: date,
          scheduled_time: template.time,
          medication_name: template.medication_name,
          dosage: template.dosage,
        },
        update: {},
      });
    }
  }

  private async sendTaskReminder(task: any) {
    const { user } = task;
    if (!user.whatsapp_number) return;

    const icon = this.getDefaultIcon(task.task_type);
    const message = `${icon} *Reminder: ${task.title}*\n\nHalo ${user.full_name}!\n\n${task.description || 'Waktunya menyelesaikan task ini!'}\n\n⏰ Jadwal: ${task.scheduled_time}\n\nJangan lupa tandai selesai di aplikasi ya!\n\n_Pesan otomatis dari Glucoin_`;

    await this.fonnte.sendMessage(user.whatsapp_number, message);
  }

  private formatTask(task: any) {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      task_type: task.task_type,
      scheduled_time: task.scheduled_time,
      is_completed: task.is_completed,
      completed_at: task.completed_at,
      icon: task.template?.icon || this.getDefaultIcon(task.task_type),
      color: task.template?.color || this.getDefaultColor(task.task_type),
      // Task-specific data
      glucose_level: task.glucose_level,
      medication_name: task.medication_name,
      dosage: task.dosage,
      exercise_minutes: task.exercise_minutes,
      water_glasses: task.water_glasses,
      notes: task.notes,
    };
  }

  private getDefaultIcon(taskType: string): string {
    const icons: Record<string, string> = {
      GLUCOSE_CHECK: '🩸',
      MEDICATION: '💊',
      INSULIN: '💉',
      EXERCISE: '🏃',
      WATER_INTAKE: '💧',
      MEAL: '🍽️',
      FOOT_CHECK: '🦶',
      BLOOD_PRESSURE: '❤️',
      WEIGHT_CHECK: '⚖️',
      CUSTOM: '📌',
    };
    return icons[taskType] || '📌';
  }

  private getDefaultColor(taskType: string): string {
    const colors: Record<string, string> = {
      GLUCOSE_CHECK: '#E53935',
      MEDICATION: '#7B1FA2',
      INSULIN: '#9C27B0',
      EXERCISE: '#4CAF50',
      WATER_INTAKE: '#2196F3',
      MEAL: '#FF9800',
      FOOT_CHECK: '#FF5722',
      BLOOD_PRESSURE: '#F44336',
      WEIGHT_CHECK: '#607D8B',
      CUSTOM: '#9E9E9E',
    };
    return colors[taskType] || '#9E9E9E';
  }

  private mapTimeToCategory(time?: string | null): GlucoseCategory {
    if (!time) return GlucoseCategory.RANDOM;

    const [hours] = time.split(':').map(Number);

    if (hours < 9) return GlucoseCategory.FASTING;
    if (hours < 12) return GlucoseCategory.BEFORE_MEAL;
    if (hours < 17) return GlucoseCategory.AFTER_MEAL;
    if (hours < 21) return GlucoseCategory.BEFORE_MEAL;
    return GlucoseCategory.BEDTIME;
  }
}
