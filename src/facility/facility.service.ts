import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateFacilityDto,
  UpdateFacilityDto,
  NearbyFacilitiesDto,
} from './dto/facility.dto';
import { Prisma } from '@glucoin/prisma';

@Injectable()
export class FacilityService {
  constructor(private prisma: PrismaService) {}

  // ============= CRUD OPERATIONS =============

  async createFacility(dto: CreateFacilityDto) {
    const facility = await this.prisma.healthcareFacility.create({
      data: {
        name: dto.name,
        type: dto.type,
        address: dto.address,
        city: dto.city,
        province: dto.province,
        phone: dto.phone,
        latitude: dto.latitude,
        longitude: dto.longitude,
        image_url: dto.image_url,
        is_open_24h: dto.is_open_24h ?? false,
        opening_time: dto.opening_time,
        closing_time: dto.closing_time,
      },
    });

    return {
      message: 'Facility created successfully',
      facility,
    };
  }

  async updateFacility(id: string, dto: UpdateFacilityDto) {
    const facility = await this.prisma.healthcareFacility.findUnique({
      where: { id },
    });

    if (!facility) {
      throw new NotFoundException('Facility not found');
    }

    const updated = await this.prisma.healthcareFacility.update({
      where: { id },
      data: dto,
    });

    return {
      message: 'Facility updated successfully',
      facility: updated,
    };
  }

  async deleteFacility(id: string) {
    const facility = await this.prisma.healthcareFacility.findUnique({
      where: { id },
    });

    if (!facility) {
      throw new NotFoundException('Facility not found');
    }

    await this.prisma.healthcareFacility.delete({
      where: { id },
    });

    return {
      message: 'Facility deleted successfully',
    };
  }

  async getFacilityById(id: string) {
    const facility = await this.prisma.healthcareFacility.findUnique({
      where: { id },
    });

    if (!facility) {
      throw new NotFoundException('Facility not found');
    }

    return facility;
  }

  async getAllFacilities(type?: string) {
    const where: Prisma.HealthcareFacilityWhereInput = {
      is_active: true,
    };

    if (type) {
      where.type = type as any;
    }

    return await this.prisma.healthcareFacility.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  // ============= POSTGIS NEARBY SEARCH =============

  async findNearbyFacilities(dto: NearbyFacilitiesDto) {
    const { latitude, longitude, radius_km = 10, type, limit = 50 } = dto;

    // Haversine formula untuk menghitung jarak dalam kilometer
    // Menggunakan raw SQL karena Prisma tidak support PostGIS langsung
    const typeFilter = type ? `AND type = '${type}'` : '';

    const facilities = await this.prisma.$queryRaw<any[]>`
      SELECT 
        id,
        name,
        type,
        address,
        city,
        province,
        phone,
        latitude,
        longitude,
        image_url,
        rating,
        rating_count,
        is_open_24h,
        opening_time,
        closing_time,
        (
          6371 * acos(
            cos(radians(${latitude})) * cos(radians(latitude::float)) *
            cos(radians(longitude::float) - radians(${longitude})) +
            sin(radians(${latitude})) * sin(radians(latitude::float))
          )
        ) AS distance_km
      FROM "HealthcareFacility"
      WHERE is_active = true
        ${type ? Prisma.sql`AND type = ${type}::"FacilityType"` : Prisma.empty}
      HAVING (
        6371 * acos(
          cos(radians(${latitude})) * cos(radians(latitude::float)) *
          cos(radians(longitude::float) - radians(${longitude})) +
          sin(radians(${latitude})) * sin(radians(latitude::float))
        )
      ) <= ${radius_km}
      ORDER BY distance_km ASC
      LIMIT ${limit}
    `;

    return {
      message: 'Nearby facilities found',
      center: { latitude, longitude },
      radius_km,
      count: facilities.length,
      facilities: facilities.map((f) => ({
        ...f,
        latitude: parseFloat(f.latitude),
        longitude: parseFloat(f.longitude),
        rating: parseFloat(f.rating),
        distance_km: Math.round(parseFloat(f.distance_km) * 100) / 100,
      })),
    };
  }

  // Alternatif: menggunakan bounding box untuk performa lebih baik
  async findNearbyFacilitiesFast(dto: NearbyFacilitiesDto) {
    const lat = Number(dto.latitude);
    const lon = Number(dto.longitude);
    const radius_km = Number(dto.radius_km) || 10;
    const type = dto.type;
    const limit = Number(dto.limit) || 50;

    // 1 derajat latitude ≈ 111 km
    // 1 derajat longitude ≈ 111 * cos(latitude) km
    const latDiff = radius_km / 111;
    const lonDiff = radius_km / (111 * Math.cos((lat * Math.PI) / 180));

    const minLat = lat - latDiff;
    const maxLat = lat + latDiff;
    const minLon = lon - lonDiff;
    const maxLon = lon + lonDiff;

    // First filter dengan bounding box (cepat)
    const where: Prisma.HealthcareFacilityWhereInput = {
      is_active: true,
      latitude: {
        gte: minLat,
        lte: maxLat,
      },
      longitude: {
        gte: minLon,
        lte: maxLon,
      },
    };

    if (type) {
      where.type = type as any;
    }

    const facilities = await this.prisma.healthcareFacility.findMany({
      where,
      take: limit * 2, // Ambil lebih banyak untuk filter lanjutan
    });

    // Kemudian hitung jarak sebenarnya dan filter
    const facilitiesWithDistance = facilities
      .map((f) => {
        const distance = this.calculateDistance(
          lat,
          lon,
          parseFloat(f.latitude.toString()),
          parseFloat(f.longitude.toString()),
        );
        return {
          ...f,
          latitude: parseFloat(f.latitude.toString()),
          longitude: parseFloat(f.longitude.toString()),
          rating: parseFloat(f.rating.toString()),
          distance_km: Math.round(distance * 100) / 100,
        };
      })
      .filter((f) => f.distance_km <= radius_km)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);

    return {
      message: 'Nearby facilities found',
      center: { latitude: lat, longitude: lon },
      radius_km,
      count: facilitiesWithDistance.length,
      facilities: facilitiesWithDistance,
    };
  }

  // Haversine formula untuk menghitung jarak antara 2 koordinat
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371; // Radius bumi dalam km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  // ============= GROUP BY TYPE =============

  async getNearbyByType(dto: NearbyFacilitiesDto) {
    const lat = Number(dto.latitude);
    const lon = Number(dto.longitude);
    const radius_km = Number(dto.radius_km) || 10;

    const types = ['HOSPITAL', 'PHARMACY', 'CLINIC', 'PUSKESMAS', 'LAB'];
    const result: Record<string, any> = {};

    for (const type of types) {
      const data = await this.findNearbyFacilitiesFast({
        latitude: lat,
        longitude: lon,
        radius_km,
        type: type as any,
        limit: 10,
      });
      result[type.toLowerCase()] = {
        count: data.count,
        facilities: data.facilities,
      };
    }

    return {
      message: 'Nearby facilities grouped by type',
      center: { latitude: lat, longitude: lon },
      radius_km,
      data: result,
    };
  }
}
