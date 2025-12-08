import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { BookingService } from './booking.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto, CancelBookingDto, BookingStatus } from './dto/update-booking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingController {
  constructor(private readonly bookingService: BookingService) {}

  // User membuat booking baru
  @Post()
  @UseGuards(RolesGuard)
  @Roles('USER')
  create(@CurrentUser() user: any, @Body() createBookingDto: CreateBookingDto) {
    return this.bookingService.create(user.id, createBookingDto);
  }

  // Admin melihat semua booking
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  findAll(
    @Query('status') status?: BookingStatus,
    @Query('doctor_id') doctorId?: string,
    @Query('date') date?: string,
  ) {
    return this.bookingService.findAll({ status, doctor_id: doctorId, date });
  }

  // User melihat booking miliknya
  @Get('my-bookings')
  @UseGuards(RolesGuard)
  @Roles('USER')
  findMyBookings(
    @CurrentUser() user: any,
    @Query('status') status?: BookingStatus,
  ) {
    return this.bookingService.findByUser(user.id, status);
  }

  // Doctor melihat booking pasiennya
  @Get('doctor-bookings')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR')
  findDoctorBookings(
    @CurrentUser() user: any,
    @Query('status') status?: BookingStatus,
    @Query('date') date?: string,
  ) {
    // Perlu cari doctor_id dari user_id
    return this.bookingService.findByDoctor(user.doctorId, status, date);
  }

  // Cek slot yang tersedia untuk dokter pada tanggal tertentu
  @Get('available-slots/:doctorId')
  getAvailableSlots(
    @Param('doctorId') doctorId: string,
    @Query('date') date: string,
  ) {
    return this.bookingService.getAvailableSlots(doctorId, date);
  }

  // Detail booking
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bookingService.findOne(id);
  }

  // Update booking (Admin/Doctor)
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DOCTOR')
  update(@Param('id') id: string, @Body() updateBookingDto: UpdateBookingDto) {
    return this.bookingService.update(id, updateBookingDto);
  }

  // Confirm booking (Doctor/Admin)
  @Patch(':id/confirm')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR', 'ADMIN')
  confirmBooking(@Param('id') id: string) {
    return this.bookingService.confirmBooking(id);
  }

  // Complete booking (Doctor/Admin)
  @Patch(':id/complete')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR', 'ADMIN')
  completeBooking(@Param('id') id: string) {
    return this.bookingService.completeBooking(id);
  }

  // Cancel booking (User/Doctor/Admin)
  @Patch(':id/cancel')
  @UseGuards(RolesGuard)
  @Roles('USER', 'DOCTOR', 'ADMIN')
  cancelBooking(@Param('id') id: string, @Body() cancelDto: CancelBookingDto) {
    return this.bookingService.cancelBooking(id, cancelDto);
  }
}
