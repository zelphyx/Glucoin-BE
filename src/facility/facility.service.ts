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

  // ============= SCRAPE FROM OSM =============

  private readonly OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

  private readonly CITIES = [
    { name: 'Jakarta Pusat', province: 'DKI Jakarta', lat: -6.1754, lon: 106.8272 },
    { name: 'Jakarta Selatan', province: 'DKI Jakarta', lat: -6.2615, lon: 106.8106 },
    { name: 'Jakarta Barat', province: 'DKI Jakarta', lat: -6.1484, lon: 106.7552 },
    { name: 'Jakarta Timur', province: 'DKI Jakarta', lat: -6.2250, lon: 106.9004 },
    { name: 'Jakarta Utara', province: 'DKI Jakarta', lat: -6.1215, lon: 106.9027 },
    { name: 'Bekasi', province: 'Jawa Barat', lat: -6.2383, lon: 106.9756 },
    { name: 'Depok', province: 'Jawa Barat', lat: -6.4025, lon: 106.7942 },
    { name: 'Tangerang', province: 'Banten', lat: -6.1702, lon: 106.6403 },
    { name: 'Bogor', province: 'Jawa Barat', lat: -6.5971, lon: 106.8060 },
    { name: 'Bandung', province: 'Jawa Barat', lat: -6.9175, lon: 107.6191 },
    { name: 'Surabaya', province: 'Jawa Timur', lat: -7.2575, lon: 112.7521 },
    { name: 'Semarang', province: 'Jawa Tengah', lat: -6.9666, lon: 110.4196 },
    { name: 'Yogyakarta', province: 'DI Yogyakarta', lat: -7.7956, lon: 110.3695 },
    { name: 'Medan', province: 'Sumatera Utara', lat: 3.5952, lon: 98.6722 },
    { name: 'Makassar', province: 'Sulawesi Selatan', lat: -5.1477, lon: 119.4327 },
    { name: 'Palembang', province: 'Sumatera Selatan', lat: -2.9761, lon: 104.7754 },
    { name: 'Denpasar', province: 'Bali', lat: -8.6705, lon: 115.2126 },
  ];

  async scrapeFromOSM(options: {
    city?: string;
    lat?: number;
    lon?: number;
    radius_km?: number;
  }) {
    const { city, lat, lon, radius_km = 15 } = options;

    // If specific city provided
    if (city) {
      const foundCity = this.CITIES.find(
        (c) => c.name.toLowerCase().includes(city.toLowerCase()),
      );
      if (foundCity) {
        const result = await this.scrapeCity(foundCity, radius_km);
        const total = await this.prisma.healthcareFacility.count();
        return {
          message: `Scraping completed for ${foundCity.name}`,
          saved: result,
          total_in_database: total,
        };
      }
    }

    // If coordinates provided
    if (lat && lon) {
      const result = await this.scrapeCity(
        { name: 'Custom Location', province: 'Unknown', lat, lon },
        radius_km,
      );
      const total = await this.prisma.healthcareFacility.count();
      return {
        message: `Scraping completed for coordinates (${lat}, ${lon})`,
        saved: result,
        total_in_database: total,
      };
    }

    // Scrape all cities
    let totalSaved = 0;
    const results: { city: string; saved: number }[] = [];

    for (const c of this.CITIES) {
      const saved = await this.scrapeCity(c, radius_km);
      totalSaved += saved;
      results.push({ city: c.name, saved });
      // Wait between cities to be nice to the API
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    const total = await this.prisma.healthcareFacility.count();

    return {
      message: 'Scraping completed for all cities',
      cities_scraped: results,
      total_saved: totalSaved,
      total_in_database: total,
    };
  }

  private async scrapeCity(
    city: { name: string; province: string; lat: number; lon: number },
    radiusKm: number,
  ): Promise<number> {
    const radiusMeters = radiusKm * 1000;

    const query = `
      [out:json][timeout:60];
      (
        node["amenity"="hospital"](around:${radiusMeters},${city.lat},${city.lon});
        way["amenity"="hospital"](around:${radiusMeters},${city.lat},${city.lon});
        node["amenity"="pharmacy"](around:${radiusMeters},${city.lat},${city.lon});
        way["amenity"="pharmacy"](around:${radiusMeters},${city.lat},${city.lon});
        node["amenity"="clinic"](around:${radiusMeters},${city.lat},${city.lon});
        way["amenity"="clinic"](around:${radiusMeters},${city.lat},${city.lon});
        node["amenity"="doctors"](around:${radiusMeters},${city.lat},${city.lon});
        node["healthcare"](around:${radiusMeters},${city.lat},${city.lon});
        way["healthcare"](around:${radiusMeters},${city.lat},${city.lon});
      );
      out center;
    `;

    try {
      const response = await fetch(this.OVERPASS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.status}`);
      }

      const data = await response.json();
      const elements = data.elements || [];

      let saved = 0;

      for (const element of elements) {
        if (!element.tags?.name) continue;

        const facilityType = this.mapOSMType(element);
        if (!facilityType) continue;

        const lat = element.lat || element.center?.lat;
        const lon = element.lon || element.center?.lon;
        if (!lat || !lon) continue;

        const facilityId = `osm_${element.type}_${element.id}`;
        const phone =
          element.tags.phone || element.tags['contact:phone'] || null;
        const address =
          element.tags['addr:full'] ||
          element.tags['addr:street'] ||
          'Alamat tidak tersedia';

        try {
          await this.prisma.healthcareFacility.upsert({
            where: { id: facilityId },
            update: {
              name: element.tags.name,
              type: facilityType as any,
              address,
              city: element.tags['addr:city'] || city.name,
              province: city.province,
              phone,
              latitude: lat,
              longitude: lon,
              is_open_24h: this.isOpen24h(element.tags.opening_hours),
              updated_at: new Date(),
            },
            create: {
              id: facilityId,
              name: element.tags.name,
              type: facilityType as any,
              address,
              city: element.tags['addr:city'] || city.name,
              province: city.province,
              phone,
              latitude: lat,
              longitude: lon,
              is_open_24h: this.isOpen24h(element.tags.opening_hours),
              rating: 0,
              rating_count: 0,
            },
          });
          saved++;
        } catch (error) {
          // Skip duplicates or errors
        }
      }

      return saved;
    } catch (error) {
      console.error(`Error scraping ${city.name}:`, error);
      return 0;
    }
  }

  private mapOSMType(element: any): string | null {
    const { amenity, healthcare } = element.tags;
    if (amenity === 'hospital' || healthcare === 'hospital') return 'HOSPITAL';
    if (amenity === 'pharmacy') return 'PHARMACY';
    if (amenity === 'clinic' || healthcare === 'clinic') return 'CLINIC';
    if (amenity === 'doctors' || healthcare === 'doctor') return 'CLINIC';
    if (healthcare === 'laboratory') return 'LAB';
    return null;
  }

  private isOpen24h(openingHours?: string): boolean {
    if (!openingHours) return false;
    return (
      openingHours.toLowerCase().includes('24/7') ||
      openingHours.toLowerCase() === '24 hours' ||
      openingHours === 'Mo-Su 00:00-24:00'
    );
  }
}
