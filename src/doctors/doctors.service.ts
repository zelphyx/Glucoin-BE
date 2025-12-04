// src/doctors/doctors.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';

@Injectable()
export class DoctorsService {
  constructor(private prisma: PrismaService) {}

  async create(createDoctorDto: CreateDoctorDto) {
    const existingDoctor = await this.prisma.doctor.findUnique({
      where: { user_id: createDoctorDto.user_id },
    });

    if (existingDoctor) {
      throw new ConflictException('Doctor profile already exists for this user');
    }

    const existingLicense = await this.prisma.doctor.findUnique({
      where: { license_number: createDoctorDto.license_number },
    });

    if (existingLicense) {
      throw new ConflictException('License number already registered');
    }


    return await this.prisma.doctor.create({
      data: {
        ...createDoctorDto,
        rating: createDoctorDto.rating || 0,
        total_patients: createDoctorDto.total_patients || 0,
        is_available: createDoctorDto.is_available ?? true,
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
      },
      orderBy: [
        { rating: 'desc' },
        { total_patients: 'desc' },
      ],
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
      },
    });

    if (!doctor) {
      throw new NotFoundException(`Doctor profile not found for user ${userId}`);
    }

    return doctor;
  }

  async update(id: string, updateDoctorDto: UpdateDoctorDto) {
    await this.findOne(id);

    if (updateDoctorDto.license_number) {
      const existingLicense = await this.prisma.doctor.findFirst({
        where: {
          license_number: updateDoctorDto.license_number,
          id: { not: id },
        },
      });

      if (existingLicense) {
        throw new ConflictException('License number already registered');
      }
    }

    return await this.prisma.doctor.update({
      where: { id },
      data: updateDoctorDto,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            full_name: true,
          },
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
      },
      orderBy: [
        { rating: 'desc' },
        { total_patients: 'desc' },
      ],
    });
  }

  async incrementTotalPatients(id: string) {
    await this.findOne(id);

    return await this.prisma.doctor.update({
      where: { id },
      data: {
        total_patients: {
          increment: 1,
        },
      },
    });
  }

  async updateRating(id: string, newRating: number) {
    await this.findOne(id);

    return await this.prisma.doctor.update({
      where: { id },
      data: { rating: newRating },
    });
  }

  async getTopRatedDoctors(limit: number = 10) {
    return await this.prisma.doctor.findMany({
      take: limit,
      where: { is_available: true },
      orderBy: { rating: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
    });
  }
}
