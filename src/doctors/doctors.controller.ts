// src/doctors/doctors.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto, DayOfWeek } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
import { AddScheduleDto, UpdateScheduleItemDto } from './dto/add-schedule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('doctors')
@UseGuards(JwtAuthGuard)
export class DoctorsController {
  constructor(private readonly doctorsService: DoctorsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  create(@Body() createDoctorDto: CreateDoctorDto) {
    return this.doctorsService.create(createDoctorDto);
  }

  @Get()
  findAll(
    @Query('specialization') specialization?: string,
    @Query('isAvailable') isAvailable?: string,
  ) {
    return this.doctorsService.findAll({
      specialization,
      isAvailable: isAvailable === 'true' ? true : isAvailable === 'false' ? false : undefined,
    });
  }

  @Get('available')
  findAvailable() {
    return this.doctorsService.findAvailable();
  }

  @Get('my-profile')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR')
  getMyProfile(@CurrentUser() user: any) {
    return this.doctorsService.findByUserId(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.doctorsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DOCTOR')
  update(@Param('id') id: string, @Body() updateDoctorDto: UpdateDoctorDto) {
    return this.doctorsService.update(id, updateDoctorDto);
  }

  @Patch(':id/availability')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR', 'ADMIN')
  updateAvailability(@Param('id') id: string, @Body('is_available') isAvailable: boolean) {
    return this.doctorsService.updateAvailability(id, isAvailable);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.doctorsService.remove(id);
  }

  // ==================== SCHEDULE ENDPOINTS ====================

  @Post(':id/schedules')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR', 'ADMIN')
  addSchedules(@Param('id') id: string, @Body() addScheduleDto: AddScheduleDto) {
    return this.doctorsService.addSchedules(id, addScheduleDto);
  }

  @Get(':id/schedules')
  getSchedules(@Param('id') id: string) {
    return this.doctorsService.getSchedules(id);
  }

  @Get(':id/schedules/:day')
  getSchedulesByDay(@Param('id') id: string, @Param('day') day: DayOfWeek) {
    return this.doctorsService.getSchedulesByDay(id, day);
  }

  @Patch('schedules/:scheduleId')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR', 'ADMIN')
  updateSchedule(
    @Param('scheduleId') scheduleId: string,
    @Body() updateData: UpdateScheduleItemDto,
  ) {
    return this.doctorsService.updateSchedule(scheduleId, updateData);
  }

  @Patch('schedules/:scheduleId/toggle')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR', 'ADMIN')
  toggleScheduleActive(
    @Param('scheduleId') scheduleId: string,
    @Body('is_active') isActive: boolean,
  ) {
    return this.doctorsService.toggleScheduleActive(scheduleId, isActive);
  }

  @Delete('schedules/:scheduleId')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR', 'ADMIN')
  deleteSchedule(@Param('scheduleId') scheduleId: string) {
    return this.doctorsService.deleteSchedule(scheduleId);
  }

  @Delete(':id/schedules')
  @UseGuards(RolesGuard)
  @Roles('DOCTOR', 'ADMIN')
  deleteAllSchedules(@Param('id') id: string) {
    return this.doctorsService.deleteAllSchedules(id);
  }
}
