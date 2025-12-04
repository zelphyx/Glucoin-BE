// src/doctors/doctors.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { DoctorsService } from './doctors.service';
import { CreateDoctorDto } from './dto/create-doctor.dto';
import { UpdateDoctorDto } from './dto/update-doctor.dto';
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

  @Get('top-rated')
  getTopRated(@Query('limit') limit?: string) {
    return this.doctorsService.getTopRatedDoctors(limit ? parseInt(limit) : 10);
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
  @Roles('DOCTOR')
  updateAvailability(@Param('id') id: string, @Body('is_available') isAvailable: boolean) {
    return this.doctorsService.updateAvailability(id, isAvailable);
  }

  @Patch(':id/rating')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  updateRating(@Param('id') id: string, @Body('rating') rating: number) {
    return this.doctorsService.updateRating(id, rating);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.doctorsService.remove(id);
  }
}
