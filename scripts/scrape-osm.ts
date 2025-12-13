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
  
  // Hospital
  if (amenity === 'hospital' || healthcare === 'hospital') return 'HOSPITAL';
  
  // Pharmacy
  if (amenity === 'pharmacy' || healthcare === 'pharmacy') return 'PHARMACY';
  
  // Clinic (termasuk dokter, dentist, health centre)
  if (amenity === 'clinic' || healthcare === 'clinic') return 'CLINIC';
  if (amenity === 'doctors' || healthcare === 'doctor') return 'CLINIC';
  if (amenity === 'dentist' || healthcare === 'dentist') return 'CLINIC';
  if (healthcare === 'centre') return 'CLINIC';
  
  // Puskesmas
  if (amenity === 'health_post' || healthcare === 'health_post') return 'PUSKESMAS';
  
  // Lab
  if (healthcare === 'laboratory' || amenity === 'laboratory') return 'LAB';
  if (healthcare === 'sample_collection') return 'LAB';
  
  return null;
}

// Query Overpass API
async function queryOverpass(
  lat: number,
  lon: number,
  radiusMeters: number,
): Promise<OSMElement[]> {
  // Overpass QL query untuk healthcare facilities - lebih lengkap
  const query = `
    [out:json][timeout:120];
    (
      // Hospitals - semua variasi
      node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      relation["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      node["healthcare"="hospital"](around:${radiusMeters},${lat},${lon});
      way["healthcare"="hospital"](around:${radiusMeters},${lat},${lon});
      
      // Clinics - semua variasi
      node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
      way["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
      relation["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
      node["healthcare"="clinic"](around:${radiusMeters},${lat},${lon});
      way["healthcare"="clinic"](around:${radiusMeters},${lat},${lon});
      node["healthcare"="centre"](around:${radiusMeters},${lat},${lon});
      way["healthcare"="centre"](around:${radiusMeters},${lat},${lon});
      node["healthcare"="doctor"](around:${radiusMeters},${lat},${lon});
      node["amenity"="doctors"](around:${radiusMeters},${lat},${lon});
      way["amenity"="doctors"](around:${radiusMeters},${lat},${lon});
      
      // Dentist
      node["amenity"="dentist"](around:${radiusMeters},${lat},${lon});
      way["amenity"="dentist"](around:${radiusMeters},${lat},${lon});
      node["healthcare"="dentist"](around:${radiusMeters},${lat},${lon});
      
      // Puskesmas / Health posts
      node["amenity"="health_post"](around:${radiusMeters},${lat},${lon});
      way["amenity"="health_post"](around:${radiusMeters},${lat},${lon});
      node["healthcare"="health_post"](around:${radiusMeters},${lat},${lon});
      
      // Pharmacies
      node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
      way["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
      node["healthcare"="pharmacy"](around:${radiusMeters},${lat},${lon});
      
      // Laboratory
      node["healthcare"="laboratory"](around:${radiusMeters},${lat},${lon});
      way["healthcare"="laboratory"](around:${radiusMeters},${lat},${lon});
      node["amenity"="laboratory"](around:${radiusMeters},${lat},${lon});
      node["healthcare"="sample_collection"](around:${radiusMeters},${lat},${lon});
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
  // eslint-disable-next-line prefer-const
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
    // Jabodetabek - dengan radius lebih besar
    { name: 'Jakarta Pusat', province: 'DKI Jakarta', lat: -6.1754, lon: 106.8272 },
    { name: 'Jakarta Selatan', province: 'DKI Jakarta', lat: -6.2615, lon: 106.8106 },
    { name: 'Jakarta Barat', province: 'DKI Jakarta', lat: -6.1484, lon: 106.7552 },
    { name: 'Jakarta Timur', province: 'DKI Jakarta', lat: -6.2250, lon: 106.9004 },
    { name: 'Jakarta Utara', province: 'DKI Jakarta', lat: -6.1215, lon: 106.9027 },
    { name: 'Bekasi', province: 'Jawa Barat', lat: -6.2383, lon: 106.9756 },
    { name: 'Depok', province: 'Jawa Barat', lat: -6.4025, lon: 106.7942 },
    { name: 'Tangerang', province: 'Banten', lat: -6.1702, lon: 106.6403 },
    { name: 'Tangerang Selatan', province: 'Banten', lat: -6.2886, lon: 106.7170 },
    { name: 'Bogor', province: 'Jawa Barat', lat: -6.5971, lon: 106.8060 },
    { name: 'Cikarang', province: 'Jawa Barat', lat: -6.3024, lon: 107.1539 },
    { name: 'Karawang', province: 'Jawa Barat', lat: -6.3227, lon: 107.3376 },
    { name: 'Cibubur', province: 'Jawa Barat', lat: -6.3694, lon: 106.8814 },
    
    // Jawa Barat
    { name: 'Bandung', province: 'Jawa Barat', lat: -6.9175, lon: 107.6191 },
    { name: 'Bandung Barat', province: 'Jawa Barat', lat: -6.8405, lon: 107.5216 },
    { name: 'Cimahi', province: 'Jawa Barat', lat: -6.8721, lon: 107.5424 },
    { name: 'Cirebon', province: 'Jawa Barat', lat: -6.7320, lon: 108.5523 },
    { name: 'Tasikmalaya', province: 'Jawa Barat', lat: -7.3274, lon: 108.2207 },
    { name: 'Sukabumi', province: 'Jawa Barat', lat: -6.9277, lon: 106.9300 },
    { name: 'Garut', province: 'Jawa Barat', lat: -7.2274, lon: 107.9086 },
    
    // Jawa Tengah
    { name: 'Semarang', province: 'Jawa Tengah', lat: -6.9666, lon: 110.4196 },
    { name: 'Solo', province: 'Jawa Tengah', lat: -7.5755, lon: 110.8243 },
    { name: 'Klaten', province: 'Jawa Tengah', lat: -7.7056, lon: 110.6042 },
    { name: 'Magelang', province: 'Jawa Tengah', lat: -7.4797, lon: 110.2177 },
    { name: 'Pekalongan', province: 'Jawa Tengah', lat: -6.8885, lon: 109.6753 },
    { name: 'Purwokerto', province: 'Jawa Tengah', lat: -7.4214, lon: 109.2342 },
    { name: 'Tegal', province: 'Jawa Tengah', lat: -6.8797, lon: 109.1256 },
    { name: 'Salatiga', province: 'Jawa Tengah', lat: -7.3305, lon: 110.5084 },
    
    // DI Yogyakarta
    { name: 'Yogyakarta', province: 'DI Yogyakarta', lat: -7.7956, lon: 110.3695 },
    { name: 'Sleman', province: 'DI Yogyakarta', lat: -7.7166, lon: 110.3558 },
    { name: 'Bantul', province: 'DI Yogyakarta', lat: -7.8895, lon: 110.3275 },
    
    // Jawa Timur
    { name: 'Surabaya', province: 'Jawa Timur', lat: -7.2575, lon: 112.7521 },
    { name: 'Surabaya Barat', province: 'Jawa Timur', lat: -7.2894, lon: 112.6753 },
    { name: 'Surabaya Timur', province: 'Jawa Timur', lat: -7.2705, lon: 112.8037 },
    { name: 'Malang', province: 'Jawa Timur', lat: -7.9666, lon: 112.6326 },
    { name: 'Sidoarjo', province: 'Jawa Timur', lat: -7.4478, lon: 112.7183 },
    { name: 'Gresik', province: 'Jawa Timur', lat: -7.1587, lon: 112.6511 },
    { name: 'Kediri', province: 'Jawa Timur', lat: -7.8480, lon: 112.0178 },
    { name: 'Jember', province: 'Jawa Timur', lat: -8.1845, lon: 113.6681 },
    { name: 'Banyuwangi', province: 'Jawa Timur', lat: -8.2194, lon: 114.3691 },
    { name: 'Mojokerto', province: 'Jawa Timur', lat: -7.4723, lon: 112.4340 },
    { name: 'Pasuruan', province: 'Jawa Timur', lat: -7.6469, lon: 112.9075 },
    
    // Banten
    { name: 'Serang', province: 'Banten', lat: -6.1103, lon: 106.1640 },
    { name: 'Cilegon', province: 'Banten', lat: -6.0023, lon: 106.0540 },
    
    // Sumatera
    { name: 'Medan', province: 'Sumatera Utara', lat: 3.5952, lon: 98.6722 },
    { name: 'Binjai', province: 'Sumatera Utara', lat: 3.6001, lon: 98.4855 },
    { name: 'Palembang', province: 'Sumatera Selatan', lat: -2.9761, lon: 104.7754 },
    { name: 'Pekanbaru', province: 'Riau', lat: 0.5071, lon: 101.4478 },
    { name: 'Padang', province: 'Sumatera Barat', lat: -0.9471, lon: 100.4172 },
    { name: 'Bandar Lampung', province: 'Lampung', lat: -5.3971, lon: 105.2668 },
    { name: 'Batam', province: 'Kepulauan Riau', lat: 1.0456, lon: 104.0305 },
    { name: 'Jambi', province: 'Jambi', lat: -1.6101, lon: 103.6131 },
    { name: 'Bengkulu', province: 'Bengkulu', lat: -3.7928, lon: 102.2608 },
    { name: 'Banda Aceh', province: 'Aceh', lat: 5.5483, lon: 95.3238 },
    
    // Kalimantan
    { name: 'Banjarmasin', province: 'Kalimantan Selatan', lat: -3.3186, lon: 114.5944 },
    { name: 'Balikpapan', province: 'Kalimantan Timur', lat: -1.2379, lon: 116.8529 },
    { name: 'Samarinda', province: 'Kalimantan Timur', lat: -0.4948, lon: 117.1436 },
    { name: 'Pontianak', province: 'Kalimantan Barat', lat: -0.0263, lon: 109.3425 },
    { name: 'Palangkaraya', province: 'Kalimantan Tengah', lat: -2.2136, lon: 113.9108 },
    
    // Sulawesi
    { name: 'Makassar', province: 'Sulawesi Selatan', lat: -5.1477, lon: 119.4327 },
    { name: 'Manado', province: 'Sulawesi Utara', lat: 1.4748, lon: 124.8421 },
    { name: 'Palu', province: 'Sulawesi Tengah', lat: -0.8917, lon: 119.8707 },
    { name: 'Kendari', province: 'Sulawesi Tenggara', lat: -3.9675, lon: 122.5947 },
    
    // Bali & Nusa Tenggara
    { name: 'Denpasar', province: 'Bali', lat: -8.6705, lon: 115.2126 },
    { name: 'Badung', province: 'Bali', lat: -8.5819, lon: 115.1773 },
    { name: 'Gianyar', province: 'Bali', lat: -8.5444, lon: 115.3253 },
    { name: 'Mataram', province: 'Nusa Tenggara Barat', lat: -8.5833, lon: 116.1167 },
    { name: 'Kupang', province: 'Nusa Tenggara Timur', lat: -10.1772, lon: 123.6070 },
    
    // Papua & Maluku
    { name: 'Jayapura', province: 'Papua', lat: -2.5916, lon: 140.6690 },
    { name: 'Ambon', province: 'Maluku', lat: -3.6954, lon: 128.1814 },
    { name: 'Sorong', province: 'Papua Barat', lat: -0.8761, lon: 131.2558 },
  ];

  let totalSaved = 0;

  for (const city of cities) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏙️  Scraping ${city.name}, ${city.province}`);
    console.log(`${'='.repeat(60)}\n`);

    const saved = await scrapeFacilitiesFromOSM(
      city.lat,
      city.lon,
      20, // 20km radius - lebih besar untuk cover lebih banyak
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
