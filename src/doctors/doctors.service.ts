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
}
