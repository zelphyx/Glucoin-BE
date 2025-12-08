import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto, CancelBookingDto, BookingStatus } from './dto/update-booking.dto';
import { DayOfWeek } from '@glucoin/prisma';

@Injectable()
export class BookingService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createBookingDto: CreateBookingDto) {
    const { doctor_id, schedule_id, booking_date, ...bookingData } = createBookingDto;

    // 1. Verify doctor exists
    const doctor = await this.prisma.doctor.findUnique({
      where: { id: doctor_id },
    });

    if (!doctor) {
      throw new NotFoundException('Doctor not found');
    }

    if (!doctor.is_available) {
      throw new BadRequestException('Doctor is not available');
    }

    // 2. Verify schedule exists and is active
    const schedule = await this.prisma.doctorSchedule.findUnique({
      where: { id: schedule_id },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    if (!schedule.is_active) {
      throw new BadRequestException('This schedule slot is not active');
    }

    // 3. Verify schedule belongs to the doctor
    if (schedule.doctor_id !== doctor_id) {
      throw new BadRequestException('Schedule does not belong to this doctor');
    }

    // 4. Verify the booking date matches the day of week
    const bookingDateObj = new Date(booking_date);
    const dayOfWeek = this.getDayOfWeek(bookingDateObj);

    if (dayOfWeek !== schedule.day_of_week) {
      throw new BadRequestException(
        `Booking date ${booking_date} is ${dayOfWeek}, but schedule is for ${schedule.day_of_week}`,
      );
    }

    // 5. Check if this schedule is already booked for this date
    const existingBooking = await this.prisma.booking.findFirst({
      where: {
        schedule_id: schedule_id,
        booking_date: bookingDateObj,
        status: {
          notIn: ['CANCELLED'],
        },
      },
    });

    if (existingBooking) {
      throw new ConflictException('This time slot is already booked for this date');
    }

    // 6. Create the booking
    const booking = await this.prisma.booking.create({
      data: {
        user_id: userId,
        doctor_id: doctor_id,
        schedule_id: schedule_id,
        booking_date: bookingDateObj,
        ...bookingData,
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                email: true,
                phone_number: true,
              },
            },
          },
        },
        schedule: true,
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone_number: true,
          },
        },
      },
    });

    return {
      message: 'Booking created successfully',
      booking: this.formatBookingResponse(booking),
    };
  }

  async findAll(filters?: { status?: BookingStatus; doctor_id?: string; date?: string }) {
    const where: any = {};

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.doctor_id) {
      where.doctor_id = filters.doctor_id;
    }

    if (filters?.date) {
      where.booking_date = new Date(filters.date);
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                email: true,
              },
            },
          },
        },
        schedule: true,
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone_number: true,
          },
        },
      },
      orderBy: [
        { booking_date: 'asc' },
        { start_time: 'asc' },
      ],
    });

    return bookings.map(booking => this.formatBookingResponse(booking));
  }

  async findByUser(userId: string, status?: BookingStatus) {
    const where: any = { user_id: userId };

    if (status) {
      where.status = status;
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                email: true,
                phone_number: true,
              },
            },
          },
        },
        schedule: true,
      },
      orderBy: [
        { booking_date: 'desc' },
        { start_time: 'asc' },
      ],
    });

    return bookings.map(booking => this.formatBookingResponse(booking));
  }

  async findByDoctor(doctorId: string, status?: BookingStatus, date?: string) {
    const where: any = { doctor_id: doctorId };

    if (status) {
      where.status = status;
    }

    if (date) {
      where.booking_date = new Date(date);
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone_number: true,
          },
        },
        schedule: true,
      },
      orderBy: [
        { booking_date: 'asc' },
        { start_time: 'asc' },
      ],
    });

    return bookings.map(booking => this.formatBookingResponse(booking));
  }

  async findOne(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
                email: true,
                phone_number: true,
              },
            },
          },
        },
        schedule: true,
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            phone_number: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${id} not found`);
    }

    return this.formatBookingResponse(booking);
  }

  async update(id: string, updateBookingDto: UpdateBookingDto) {
    await this.findOne(id);

    const booking = await this.prisma.booking.update({
      where: { id },
      data: updateBookingDto,
      include: {
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
              },
            },
          },
        },
        schedule: true,
        user: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
    });

    return this.formatBookingResponse(booking);
  }

  async confirmBooking(id: string) {
    const booking = await this.findOne(id);

    if (booking.status !== 'PENDING') {
      throw new BadRequestException('Only pending bookings can be confirmed');
    }

    return await this.update(id, { status: BookingStatus.CONFIRMED });
  }

  async completeBooking(id: string) {
    const booking = await this.findOne(id);

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException('Only confirmed bookings can be completed');
    }

    return await this.update(id, { status: BookingStatus.COMPLETED });
  }

  async cancelBooking(id: string, cancelDto: CancelBookingDto) {
    const booking = await this.findOne(id);

    if (booking.status === 'CANCELLED') {
      throw new BadRequestException('Booking is already cancelled');
    }

    if (booking.status === 'COMPLETED') {
      throw new BadRequestException('Completed bookings cannot be cancelled');
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancellation_reason: cancelDto.cancellation_reason,
      },
      include: {
        doctor: {
          include: {
            user: {
              select: {
                id: true,
                full_name: true,
              },
            },
          },
        },
        schedule: true,
        user: {
          select: {
            id: true,
            full_name: true,
          },
        },
      },
    });

    return {
      message: 'Booking cancelled successfully',
      booking: this.formatBookingResponse(updatedBooking),
    };
  }

  // Check available slots for a doctor on a specific date
  async getAvailableSlots(doctorId: string, date: string) {
    const bookingDate = new Date(date);
    const dayOfWeek = this.getDayOfWeek(bookingDate);

    // Get all active schedules for this doctor on this day
    const schedules = await this.prisma.doctorSchedule.findMany({
      where: {
        doctor_id: doctorId,
        day_of_week: dayOfWeek,
        is_active: true,
      },
      orderBy: { time_slot: 'asc' },
    });

    // Get all bookings for this doctor on this date (excluding cancelled)
    const existingBookings = await this.prisma.booking.findMany({
      where: {
        doctor_id: doctorId,
        booking_date: bookingDate,
        status: {
          notIn: ['CANCELLED'],
        },
      },
      select: {
        schedule_id: true,
      },
    });

    const bookedScheduleIds = existingBookings.map(b => b.schedule_id);

    // Mark each schedule as available or booked
    const slots = schedules.map(schedule => ({
      id: schedule.id,
      time_slot: schedule.time_slot,
      duration_minutes: schedule.duration_minutes,
      is_available: !bookedScheduleIds.includes(schedule.id),
    }));

    return {
      date: date,
      day_of_week: dayOfWeek,
      slots: slots,
    };
  }

  // Helper: Get day of week from date
  private getDayOfWeek(date: Date): DayOfWeek {
    const days: DayOfWeek[] = [
      DayOfWeek.SUNDAY,
      DayOfWeek.MONDAY,
      DayOfWeek.TUESDAY,
      DayOfWeek.WEDNESDAY,
      DayOfWeek.THURSDAY,
      DayOfWeek.FRIDAY,
      DayOfWeek.SATURDAY,
    ];
    return days[date.getDay()];
  }

  // Helper: Format booking response
  private formatBookingResponse(booking: any) {
    const consultationType = booking.consultation_type === 'OFFLINE' 
      ? 'Langsung ke Tempat' 
      : 'Online';

    return {
      id: booking.id,
      booking_date: booking.booking_date,
      start_time: booking.start_time,
      end_time: booking.end_time,
      duration_minutes: booking.duration_minutes,
      consultation_type: booking.consultation_type,
      consultation_type_label: consultationType,
      consultation_fee: booking.consultation_fee,
      status: booking.status,
      notes: booking.notes,
      cancellation_reason: booking.cancellation_reason,
      created_at: booking.created_at,
      updated_at: booking.updated_at,
      doctor: booking.doctor ? {
        id: booking.doctor.id,
        specialization: booking.doctor.specialization,
        alamat_praktek: booking.doctor.alamat_praktek,
        name: booking.doctor.user?.full_name,
        email: booking.doctor.user?.email,
        phone: booking.doctor.user?.phone_number,
      } : undefined,
      user: booking.user ? {
        id: booking.user.id,
        name: booking.user.full_name,
        email: booking.user.email,
        phone: booking.user.phone_number,
      } : undefined,
      schedule: booking.schedule ? {
        id: booking.schedule.id,
        day_of_week: booking.schedule.day_of_week,
        time_slot: booking.schedule.time_slot,
      } : undefined,
    };
  }
}
