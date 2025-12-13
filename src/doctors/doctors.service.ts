// src/doctors/doctors.service.ts
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { AddScheduleDto, UpdateScheduleItemDto } from './dto/add-schedule.dto';
import { DayOfWeek } from './dto/create-doctor.dto';

@Injectable()
export class DoctorsService {
  constructor(private prisma: PrismaService) {}

  async create(createDoctorDto: CreateDoctorDto) {
    const { schedules, ...doctorData } = createDoctorDto;

    const existingDoctor = await this.prisma.doctor.findUnique({
      where: { user_id: createDoctorDto.user_id },
    });

    if (existingDoctor) {
      throw new ConflictException('Doctor profile already exists for this user');
    }

    // Verify user exists and has DOCTOR role
    const user = await this.prisma.user.findUnique({
      where: { id: createDoctorDto.user_id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== 'DOCTOR') {
      throw new BadRequestException('User must have DOCTOR role');
    }

    return await this.prisma.doctor.create({
      data: {
        ...doctorData,
        is_available: doctorData.is_available ?? true,
        schedules: schedules && schedules.length > 0 ? {
          create: schedules.map(schedule => ({
            day_of_week: schedule.day_of_week,
            time_slot: schedule.time_slot,
            duration_minutes: schedule.duration_minutes ?? 60,
            is_active: schedule.is_active ?? true,
          })),
        } : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
            role: true,
            phone_number: true,
          },
        },
        schedules: {
          orderBy: [
            { day_of_week: 'asc' },
            { time_slot: 'asc' },
          ],
        },
      },
    });
  }

  async findAll(filters?: { specialization?: string; isAvailable?: boolean }) {
    const where: any = {};

    if (filters?.specialization) {
      where.specialization = { contains: filters.specialization, mode: 'insensitive' };
    }

    if (filters?.isAvailable !== undefined) {
      where.is_available = filters.isAvailable;
    }

    return await this.prisma.doctor.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
            phone_number: true,
          },
        },
        schedules: {
          where: { is_active: true },
          orderBy: [
            { day_of_week: 'asc' },
            { time_slot: 'asc' },
          ],
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
            phone_number: true,
            date_of_birth: true,
            gender: true,
          },
        },
        schedules: {
          orderBy: [
            { day_of_week: 'asc' },
            { time_slot: 'asc' },
          ],
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor with ID ${id} not found`);
    }

    return doctor;
  }

  async findByUserId(userId: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { user_id: userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
            phone_number: true,
          },
        },
        schedules: {
          orderBy: [
            { day_of_week: 'asc' },
            { time_slot: 'asc' },
          ],
        },
      },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor profile not found for user ${userId}`);
    }

    return doctor;
  }

  async update(id: string, updateDoctorDto: UpdateDoctorDto) {
    await this.findOne(id);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { schedules, ...doctorData } = updateDoctorDto;

    return await this.prisma.doctor.update({
      where: { id },
      data: doctorData,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
          },
        },
        schedules: {
          orderBy: [
            { day_of_week: 'asc' },
            { time_slot: 'asc' },
          ],
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return await this.prisma.doctor.delete({
      where: { id },
    });
  }

  async updateAvailability(id: string, isAvailable: boolean) {
    await this.findOne(id);

    return await this.prisma.doctor.update({
      where: { id },
      data: { is_available: isAvailable },
      include: {
        schedules: true,
      },
    });
  }

  async findAvailable() {
    return await this.prisma.doctor.findMany({
      where: { is_available: true },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            phone_number: true,
          },
        },
        schedules: {
          where: { is_active: true },
          orderBy: [
            { day_of_week: 'asc' },
            { time_slot: 'asc' },
          ],
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  // ==================== SCHEDULE MANAGEMENT ====================

  async addSchedules(doctorId: string, addScheduleDto: AddScheduleDto) {
    await this.findOne(doctorId);

    const createdSchedules = await this.prisma.doctorSchedule.createMany({
      data: addScheduleDto.schedules.map(schedule => ({
        doctor_id: doctorId,
        day_of_week: schedule.day_of_week,
        time_slot: schedule.time_slot,
        duration_minutes: schedule.duration_minutes ?? 60,
        is_active: schedule.is_active ?? true,
      })),
      skipDuplicates: true,
    });

    return {
      message: `${createdSchedules.count} schedule(s) added successfully`,
      doctor: await this.findOne(doctorId),
    };
  }

  async getSchedules(doctorId: string) {
    await this.findOne(doctorId);

    return await this.prisma.doctorSchedule.findMany({
      where: { doctor_id: doctorId },
      orderBy: [
        { day_of_week: 'asc' },
        { time_slot: 'asc' },
      ],
    });
  }

  async getSchedulesByDay(doctorId: string, dayOfWeek: DayOfWeek) {
    await this.findOne(doctorId);

    return await this.prisma.doctorSchedule.findMany({
      where: {
        doctor_id: doctorId,
        day_of_week: dayOfWeek,
        is_active: true,
      },
      orderBy: { time_slot: 'asc' },
    });
  }

  async updateSchedule(scheduleId: string, updateData: UpdateScheduleItemDto) {
    const schedule = await this.prisma.doctorSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${scheduleId} not found`);
    }

    return await this.prisma.doctorSchedule.update({
      where: { id: scheduleId },
      data: updateData,
    });
  }

  async deleteSchedule(scheduleId: string) {
    const schedule = await this.prisma.doctorSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${scheduleId} not found`);
    }

    return await this.prisma.doctorSchedule.delete({
      where: { id: scheduleId },
    });
  }

  async deleteAllSchedules(doctorId: string) {
    await this.findOne(doctorId);

    const deleted = await this.prisma.doctorSchedule.deleteMany({
      where: { doctor_id: doctorId },
    });

    return {
      message: `${deleted.count} schedule(s) deleted successfully`,
    };
  }

  async toggleScheduleActive(scheduleId: string, isActive: boolean) {
    const schedule = await this.prisma.doctorSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!schedule) {
      throw new NotFoundException(`Schedule with ID ${scheduleId} not found`);
    }

    return await this.prisma.doctorSchedule.update({
      where: { id: scheduleId },
      data: { is_active: isActive },
    });
  }

  // ==================== DOCTOR STATISTICS ====================

  /**
   * Get doctor's income statistics
   * - Total income from completed bookings
   * - Income by period (today, this week, this month, all time)
   */
  async getDoctorIncome(doctorId: string, period?: 'today' | 'week' | 'month' | 'year' | 'all') {
    await this.findOne(doctorId);

    const now = new Date();
    let startDate: Date | undefined;

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week': {
        const dayOfWeek = now.getDay();
        startDate = new Date(now);
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        break;
      }
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = undefined;
    }

    const whereClause: any = {
      doctor_id: doctorId,
      status: 'COMPLETED',
      payment_status: 'PAID',
    };

    if (startDate) {
      whereClause.booking_date = { gte: startDate };
    }

    // Get completed and paid bookings
    const bookings = await this.prisma.booking.findMany({
      where: whereClause,
      select: {
        id: true,
        consultation_fee: true,
        booking_date: true,
        consultation_type: true,
      },
    });

    const totalIncome = bookings.reduce(
      (sum, booking) => sum + Number(booking.consultation_fee),
      0,
    );

    // Get income breakdown by consultation type
    const incomeByType = {
      ONLINE: 0,
      OFFLINE: 0,
    };

    bookings.forEach((booking) => {
      incomeByType[booking.consultation_type] += Number(booking.consultation_fee);
    });

    // Get monthly income for chart (last 6 months)
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyBookings = await this.prisma.booking.findMany({
      where: {
        doctor_id: doctorId,
        status: 'COMPLETED',
        payment_status: 'PAID',
        booking_date: { gte: sixMonthsAgo },
      },
      select: {
        consultation_fee: true,
        booking_date: true,
      },
    });

    const monthlyIncome: { month: string; income: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now);
      monthDate.setMonth(monthDate.getMonth() - i);
      const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      const monthName = monthDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });

      const monthTotal = monthlyBookings
        .filter((b) => {
          const bookingMonth = `${b.booking_date.getFullYear()}-${String(b.booking_date.getMonth() + 1).padStart(2, '0')}`;
          return bookingMonth === monthKey;
        })
        .reduce((sum, b) => sum + Number(b.consultation_fee), 0);

      monthlyIncome.push({ month: monthName, income: monthTotal });
    }

    return {
      period: period || 'all',
      total_income: totalIncome,
      total_bookings: bookings.length,
      average_per_booking: bookings.length > 0 ? Math.round(totalIncome / bookings.length) : 0,
      income_by_type: incomeByType,
      monthly_income: monthlyIncome,
    };
  }

  /**
   * Get total patients handled by doctor
   * - Unique patients count
   * - Total consultations completed
   */
  async getDoctorPatients(doctorId: string) {
    await this.findOne(doctorId);

    // Get all completed bookings
    const bookings = await this.prisma.booking.findMany({
      where: {
        doctor_id: doctorId,
        status: 'COMPLETED',
      },
      select: {
        id: true,
        user_id: true,
        booking_date: true,
        consultation_type: true,
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            gender: true,
          },
        },
      },
      orderBy: { booking_date: 'desc' },
    });

    // Get unique patients
    const uniquePatientIds = [...new Set(bookings.map((b) => b.user_id))];
    const uniquePatients = uniquePatientIds.map((userId) => {
      const patientBookings = bookings.filter((b) => b.user_id === userId);
      return {
        user: patientBookings[0].user,
        total_visits: patientBookings.length,
        last_visit: patientBookings[0].booking_date,
        first_visit: patientBookings[patientBookings.length - 1].booking_date,
      };
    });

    // Stats by consultation type
    const statsByType = {
      ONLINE: bookings.filter((b) => b.consultation_type === 'ONLINE').length,
      OFFLINE: bookings.filter((b) => b.consultation_type === 'OFFLINE').length,
    };

    return {
      total_unique_patients: uniquePatients.length,
      total_consultations: bookings.length,
      consultations_by_type: statsByType,
      recent_patients: uniquePatients.slice(0, 10), // Last 10 patients
    };
  }

  /**
   * Get upcoming appointments for doctor
   * - Appointments that are confirmed/pending
   * - Sorted by date and time
   */
  async getUpcomingAppointments(doctorId: string, limit?: number) {
    await this.findOne(doctorId);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const appointments = await this.prisma.booking.findMany({
      where: {
        doctor_id: doctorId,
        status: { in: ['CONFIRMED', 'PENDING'] },
        booking_date: { gte: today },
      },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone_number: true,
            gender: true,
            date_of_birth: true,
          },
        },
        schedule: {
          select: {
            day_of_week: true,
            time_slot: true,
            duration_minutes: true,
          },
        },
      },
      orderBy: [
        { booking_date: 'asc' },
        { start_time: 'asc' },
      ],
      take: limit || 20,
    });

    // Group by date
    const groupedByDate: Record<string, any[]> = {};
    appointments.forEach((apt) => {
      const dateKey = apt.booking_date.toISOString().split('T')[0];
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = [];
      }
      groupedByDate[dateKey].push({
        id: apt.id,
        patient: apt.user,
        date: apt.booking_date,
        start_time: apt.start_time,
        end_time: apt.end_time,
        duration_minutes: apt.duration_minutes,
        consultation_type: apt.consultation_type,
        consultation_fee: apt.consultation_fee,
        status: apt.status,
        notes: apt.notes,
      });
    });

    // Today's appointments
    const todayKey = today.toISOString().split('T')[0];
    const todayAppointments = groupedByDate[todayKey] || [];

    return {
      total_upcoming: appointments.length,
      today_count: todayAppointments.length,
      today_appointments: todayAppointments,
      upcoming_by_date: groupedByDate,
      appointments: appointments.map((apt) => ({
        id: apt.id,
        patient: apt.user,
        date: apt.booking_date,
        start_time: apt.start_time,
        end_time: apt.end_time,
        duration_minutes: apt.duration_minutes,
        consultation_type: apt.consultation_type,
        consultation_fee: apt.consultation_fee,
        status: apt.status,
        notes: apt.notes,
      })),
    };
  }

  /**
   * Get complete doctor dashboard stats
   */
  async getDoctorDashboard(doctorId: string) {
    const [income, patients, upcoming] = await Promise.all([
      this.getDoctorIncome(doctorId, 'month'),
      this.getDoctorPatients(doctorId),
      this.getUpcomingAppointments(doctorId, 5),
    ]);

    // Get today's completed
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCompleted = await this.prisma.booking.count({
      where: {
        doctor_id: doctorId,
        status: 'COMPLETED',
        booking_date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    return {
      summary: {
        total_income_this_month: income.total_income,
        total_patients: patients.total_unique_patients,
        total_consultations: patients.total_consultations,
        upcoming_appointments: upcoming.total_upcoming,
        today_appointments: upcoming.today_count,
        today_completed: todayCompleted,
      },
      income: income,
      patients: {
        total: patients.total_unique_patients,
        by_type: patients.consultations_by_type,
      },
      upcoming: upcoming.today_appointments.slice(0, 3),
      monthly_chart: income.monthly_income,
    };
  }
}
