/**
 * Script untuk fetch data healthcare facilities dari sumber publik
 * TANPA API key - menggunakan data dari OpenStreetMap via Overpass API
 * 
 * Usage:
 * npx ts-node scripts/scrape-osm.ts
 * npx ts-node scripts/scrape-osm.ts --all  (scrape multiple cities)
 */

import { PrismaClient } from '@glucoin/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Overpass API untuk query OpenStreetMap
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

interface OSMElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: {
    name?: string;
    amenity?: string;
    healthcare?: string;
    'addr:street'?: string;
    'addr:city'?: string;
    'addr:full'?: string;
    phone?: string;
    'contact:phone'?: string;
    opening_hours?: string;
    website?: string;
  };
}

// Map OSM amenity/healthcare tag to our FacilityType
function mapOSMType(element: OSMElement): string | null {
  const { amenity, healthcare } = element.tags;
  
  if (amenity === 'hospital' || healthcare === 'hospital') return 'HOSPITAL';
  if (amenity === 'pharmacy') return 'PHARMACY';
  if (amenity === 'clinic' || healthcare === 'clinic') return 'CLINIC';
  if (amenity === 'doctors' || healthcare === 'doctor') return 'CLINIC';
  if (healthcare === 'laboratory') return 'LAB';
  
  return null;
}

// Query Overpass API
async function queryOverpass(
  lat: number,
  lon: number,
  radiusMeters: number,
): Promise<OSMElement[]> {
  // Overpass QL query untuk healthcare facilities
  const query = `
    [out:json][timeout:60];
    (
      // Hospitals
      node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      
      // Pharmacies
      node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
      way["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
      
      // Clinics
      node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
      way["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
      node["amenity"="doctors"](around:${radiusMeters},${lat},${lon});
      
      // Healthcare generic
      node["healthcare"](around:${radiusMeters},${lat},${lon});
      way["healthcare"](around:${radiusMeters},${lat},${lon});
    );
    out center;
  `;

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status}`);
  }

  const data = await response.json();
  return data.elements || [];
}

// Parse city and province from tags or use default
function parseLocation(element: OSMElement, defaultCity: string, defaultProvince: string) {
  let city = element.tags['addr:city'] || defaultCity;
  let province = defaultProvince;

  // Detect province from city name
  if (city.toLowerCase().includes('jakarta')) {
    province = 'DKI Jakarta';
  } else if (city.toLowerCase().includes('bandung')) {
    province = 'Jawa Barat';
  } else if (city.toLowerCase().includes('surabaya')) {
    province = 'Jawa Timur';
  }

  return { city, province };
}

// Check if open 24 hours from OSM opening_hours tag
function isOpen24h(openingHours?: string): boolean {
  if (!openingHours) return false;
  return openingHours.toLowerCase().includes('24/7') || 
         openingHours.toLowerCase() === '24 hours' ||
         openingHours === 'Mo-Su 00:00-24:00';
}

// Build address from OSM tags
function buildAddress(element: OSMElement): string {
  if (element.tags['addr:full']) {
    return element.tags['addr:full'];
  }
  
  const parts: string[] = [];
  if (element.tags['addr:street']) parts.push(element.tags['addr:street']);
  if (element.tags['addr:city']) parts.push(element.tags['addr:city']);
  
  return parts.length > 0 ? parts.join(', ') : 'Alamat tidak tersedia';
}

// Main scraping function
async function scrapeFacilitiesFromOSM(
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  cityName: string,
  provinceName: string,
) {
  const radiusMeters = radiusKm * 1000;

  console.log(`🔍 Fetching from OpenStreetMap around (${centerLat}, ${centerLon}) within ${radiusKm}km...`);

  try {
    const elements = await queryOverpass(centerLat, centerLon, radiusMeters);
    console.log(`📊 Found ${elements.length} elements from OSM`);

    let saved = 0;
    let skipped = 0;

    for (const element of elements) {
      // Skip elements without name
      if (!element.tags.name) {
        skipped++;
        continue;
      }

      const facilityType = mapOSMType(element);
      if (!facilityType) {
        skipped++;
        continue;
      }

      // Get coordinates (handle both node and way)
      const lat = element.lat || element.center?.lat;
      const lon = element.lon || element.center?.lon;

      if (!lat || !lon) {
        skipped++;
        continue;
      }

      const { city, province } = parseLocation(element, cityName, provinceName);
      const phone = element.tags.phone || element.tags['contact:phone'] || null;
      const address = buildAddress(element);

      // Generate unique ID from OSM type and id
      const facilityId = `osm_${element.type}_${element.id}`;

      try {
        await prisma.healthcareFacility.upsert({
          where: { id: facilityId },
          update: {
            name: element.tags.name,
            type: facilityType as any,
            address,
            city,
            province,
            phone,
            latitude: lat,
            longitude: lon,
            is_open_24h: isOpen24h(element.tags.opening_hours),
            updated_at: new Date(),
          },
          create: {
            id: facilityId,
            name: element.tags.name,
            type: facilityType as any,
            address,
            city,
            province,
            phone,
            latitude: lat,
            longitude: lon,
            is_open_24h: isOpen24h(element.tags.opening_hours),
            rating: 0,
            rating_count: 0,
          },
        });

        saved++;
        console.log(`✅ ${element.tags.name} (${facilityType})`);
      } catch (error: any) {
        console.error(`❌ Failed to save ${element.tags.name}:`, error.message);
      }
    }

    console.log(`\n📈 Results for ${cityName}:`);
    console.log(`   Saved: ${saved}`);
    console.log(`   Skipped: ${skipped}`);

    return saved;
  } catch (error) {
    console.error('Error querying Overpass API:', error);
    return 0;
  }
}

// Scrape multiple cities in Indonesia
async function scrapeMultipleCities() {
  const cities = [
    // Jabodetabek
    { name: 'Jakarta Pusat', province: 'DKI Jakarta', lat: -6.1754, lon: 106.8272 },
    { name: 'Jakarta Selatan', province: 'DKI Jakarta', lat: -6.2615, lon: 106.8106 },
    { name: 'Jakarta Barat', province: 'DKI Jakarta', lat: -6.1484, lon: 106.7552 },
    { name: 'Jakarta Timur', province: 'DKI Jakarta', lat: -6.2250, lon: 106.9004 },
    { name: 'Jakarta Utara', province: 'DKI Jakarta', lat: -6.1215, lon: 106.9027 },
    { name: 'Bekasi', province: 'Jawa Barat', lat: -6.2383, lon: 106.9756 },
    { name: 'Depok', province: 'Jawa Barat', lat: -6.4025, lon: 106.7942 },
    { name: 'Tangerang', province: 'Banten', lat: -6.1702, lon: 106.6403 },
    { name: 'Bogor', province: 'Jawa Barat', lat: -6.5971, lon: 106.8060 },
    
    // Other major cities
    { name: 'Bandung', province: 'Jawa Barat', lat: -6.9175, lon: 107.6191 },
    { name: 'Surabaya', province: 'Jawa Timur', lat: -7.2575, lon: 112.7521 },
    { name: 'Semarang', province: 'Jawa Tengah', lat: -6.9666, lon: 110.4196 },
    { name: 'Yogyakarta', province: 'DI Yogyakarta', lat: -7.7956, lon: 110.3695 },
    { name: 'Medan', province: 'Sumatera Utara', lat: 3.5952, lon: 98.6722 },
    { name: 'Makassar', province: 'Sulawesi Selatan', lat: -5.1477, lon: 119.4327 },
    { name: 'Palembang', province: 'Sumatera Selatan', lat: -2.9761, lon: 104.7754 },
    { name: 'Denpasar', province: 'Bali', lat: -8.6705, lon: 115.2126 },
  ];

  let totalSaved = 0;

  for (const city of cities) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏙️  Scraping ${city.name}, ${city.province}`);
    console.log(`${'='.repeat(60)}\n`);

    const saved = await scrapeFacilitiesFromOSM(
      city.lat,
      city.lon,
      15, // 15km radius
      city.name,
      city.province,
    );

    totalSaved += saved;

    // Wait between cities to be nice to the API
    console.log('⏳ Waiting 5 seconds before next city...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎉 SCRAPING COMPLETED!`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Total facilities saved: ${totalSaved}`);
  console.log(`Total in database: ${await prisma.healthcareFacility.count()}`);
}

// Run
const args = process.argv.slice(2);

if (args.includes('--all')) {
  scrapeMultipleCities()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
} else {
  // Single city (default: Jakarta)
  const lat = parseFloat(args[0]) || -6.1754;
  const lon = parseFloat(args[1]) || 106.8272;
  const radius = parseFloat(args[2]) || 10;

  scrapeFacilitiesFromOSM(lat, lon, radius, 'Jakarta', 'DKI Jakarta')
    .then(async () => {
      console.log(`\nTotal in database: ${await prisma.healthcareFacility.count()}`);
    })
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
