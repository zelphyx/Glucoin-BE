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
} from '@nestjs/common';
import { FacilityService } from './facility.service';
import {
  CreateFacilityDto,
  UpdateFacilityDto,
  NearbyFacilitiesDto,
} from './dto/facility.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('facilities')
export class FacilityController {
  constructor(private readonly facilityService: FacilityService) {}

  // ============= PUBLIC ENDPOINTS =============

  // Get nearby facilities (dengan Haversine formula - fast)
  @Get('nearby')
  findNearby(@Query() query: NearbyFacilitiesDto) {
    return this.facilityService.findNearbyFacilitiesFast(query);
  }

  // Get nearby facilities grouped by type
  @Get('nearby/grouped')
  findNearbyGrouped(@Query() query: NearbyFacilitiesDto) {
    return this.facilityService.getNearbyByType(query);
  }

  // Get all facilities (with optional type filter)
  @Get()
  findAll(@Query('type') type?: string) {
    return this.facilityService.getAllFacilities(type);
  }

  // Get facility by ID
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.facilityService.getFacilityById(id);
  }

  // ============= ADMIN ENDPOINTS =============

  // Create new facility (Admin only)
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateFacilityDto) {
    return this.facilityService.createFacility(dto);
  }

  // Update facility (Admin only)
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() dto: UpdateFacilityDto) {
    return this.facilityService.updateFacility(id, dto);
  }

  // Delete facility (Admin only)
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.facilityService.deleteFacility(id);
  }

  // Trigger scrape from OSM (Admin only)
  @Post('scrape')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  scrapeFromOSM(
    @Query('city') city?: string,
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
    @Query('radius_km') radiusKm?: string,
  ) {
    return this.facilityService.scrapeFromOSM({
      city,
      lat: lat ? parseFloat(lat) : undefined,
      lon: lon ? parseFloat(lon) : undefined,
      radius_km: radiusKm ? parseFloat(radiusKm) : 15,
    });
  }
}
