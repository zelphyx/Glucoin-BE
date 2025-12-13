/**
 * Script untuk scraping data healthcare facilities dari Google Places API
 * 
 * Setup:
 * 1. Dapatkan API Key dari Google Cloud Console: https://console.cloud.google.com/
 * 2. Enable "Places API" dan "Geocoding API"
 * 3. Set API key di .env: GOOGLE_PLACES_API_KEY=your_key
 * 
 * Usage:
 * npx ts-node scripts/scrape-facilities.ts
 */

import { PrismaClient } from '@glucoin/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  user_ratings_total?: number;
  formatted_phone_number?: string;
  opening_hours?: {
    open_now: boolean;
    periods?: any[];
  };
  types: string[];
}

// Mapping Google Place types ke FacilityType kita
function mapPlaceType(types: string[]): string | null {
  if (types.includes('hospital')) return 'HOSPITAL';
  if (types.includes('pharmacy') || types.includes('drugstore')) return 'PHARMACY';
  if (types.includes('doctor') || types.includes('health')) return 'CLINIC';
  if (types.includes('physiotherapist')) return 'CLINIC';
  return null;
}

// Search places by type and location
async function searchPlaces(
  lat: number,
  lng: number,
  type: string,
  radius: number = 10000, // 10km
): Promise<PlaceResult[]> {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== 'OK') {
    console.error(`Error searching ${type}:`, data.status, data.error_message);
    return [];
  }
  
  return data.results;
}

// Get place details (phone number, opening hours)
async function getPlaceDetails(placeId: string): Promise<Partial<PlaceResult> | null> {
  const fields = 'formatted_phone_number,opening_hours';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== 'OK') {
    return null;
  }
  
  return data.result;
}

// Extract city and province from address
function parseAddress(address: string): { city: string; province: string } {
  // Indonesian address format: "..., Kota/Kab. X, Provinsi Y, Indonesia"
  const parts = address.split(',').map(p => p.trim());
  
  let city = 'Unknown';
  let province = 'Unknown';
  
  for (const part of parts) {
    if (part.includes('Jakarta')) {
      city = part;
      province = 'DKI Jakarta';
    } else if (part.includes('Bandung') || part.includes('Bekasi') || part.includes('Bogor') || part.includes('Depok')) {
      city = part;
      province = 'Jawa Barat';
    } else if (part.includes('Surabaya') || part.includes('Malang')) {
      city = part;
      province = 'Jawa Timur';
    } else if (part.includes('Semarang') || part.includes('Yogyakarta')) {
      city = part;
      province = part.includes('Yogyakarta') ? 'DI Yogyakarta' : 'Jawa Tengah';
    }
  }
  
  return { city, province };
}

// Check if facility is open 24 hours
function isOpen24Hours(openingHours?: any): boolean {
  if (!openingHours?.periods) return false;
  
  // If there's only one period and it starts at 0000 with no close time
  const periods = openingHours.periods;
  if (periods.length === 1 && periods[0].open?.time === '0000' && !periods[0].close) {
    return true;
  }
  return false;
}

// Main scraping function
async function scrapeFacilities(
  centerLat: number,
  centerLng: number,
  radiusKm: number = 10,
) {
  if (!GOOGLE_API_KEY) {
    console.error('❌ GOOGLE_PLACES_API_KEY not set in .env');
    console.log('\nTo get an API key:');
    console.log('1. Go to https://console.cloud.google.com/');
    console.log('2. Create a project');
    console.log('3. Enable "Places API"');
    console.log('4. Create credentials (API Key)');
    console.log('5. Add to .env: GOOGLE_PLACES_API_KEY=your_key');
    return;
  }

  const radiusMeters = radiusKm * 1000;
  const types = ['hospital', 'pharmacy', 'doctor', 'health'];
  const allPlaces: PlaceResult[] = [];
  const seenIds = new Set<string>();

  console.log(`🔍 Searching healthcare facilities around (${centerLat}, ${centerLng}) within ${radiusKm}km...\n`);

  // Search for each type
  for (const type of types) {
    console.log(`📍 Searching for ${type}...`);
    const places = await searchPlaces(centerLat, centerLng, type, radiusMeters);
    
    for (const place of places) {
      if (!seenIds.has(place.place_id)) {
        seenIds.add(place.place_id);
        allPlaces.push(place);
      }
    }
    
    console.log(`   Found ${places.length} places`);
    
    // Rate limiting - Google allows 10 QPS
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n📊 Total unique places found: ${allPlaces.length}`);
  console.log('💾 Saving to database...\n');

  let saved = 0;
  let skipped = 0;

  for (const place of allPlaces) {
    const facilityType = mapPlaceType(place.types);
    if (!facilityType) {
      skipped++;
      continue;
    }

    // Get additional details
    const details = await getPlaceDetails(place.place_id);
    const { city, province } = parseAddress(place.formatted_address);

    try {
      await prisma.healthcareFacility.upsert({
        where: {
          id: place.place_id, // Use place_id as our ID
        },
        update: {
          name: place.name,
          type: facilityType as any,
          address: place.formatted_address,
          city,
          province,
          phone: details?.formatted_phone_number || null,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          rating: place.rating || 0,
          rating_count: place.user_ratings_total || 0,
          is_open_24h: isOpen24Hours(details?.opening_hours),
          updated_at: new Date(),
        },
        create: {
          id: place.place_id,
          name: place.name,
          type: facilityType as any,
          address: place.formatted_address,
          city,
          province,
          phone: details?.formatted_phone_number || null,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          rating: place.rating || 0,
          rating_count: place.user_ratings_total || 0,
          is_open_24h: isOpen24Hours(details?.opening_hours),
        },
      });

      saved++;
      console.log(`✅ ${place.name} (${facilityType})`);
    } catch (error) {
      console.error(`❌ Failed to save ${place.name}:`, error);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  console.log(`\n🎉 Scraping completed!`);
  console.log(`   Saved: ${saved}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Total in DB: ${await prisma.healthcareFacility.count()}`);
}

// Scrape multiple cities
async function scrapeMultipleCities() {
  const cities = [
    { name: 'Jakarta Pusat', lat: -6.1754, lng: 106.8272 },
    { name: 'Jakarta Selatan', lat: -6.2615, lng: 106.8106 },
    { name: 'Jakarta Barat', lat: -6.1484, lng: 106.7552 },
    { name: 'Jakarta Timur', lat: -6.2250, lng: 106.9004 },
    { name: 'Jakarta Utara', lat: -6.1215, lng: 106.9027 },
    { name: 'Bekasi', lat: -6.2383, lng: 106.9756 },
    { name: 'Depok', lat: -6.4025, lng: 106.7942 },
    { name: 'Tangerang', lat: -6.1702, lng: 106.6403 },
    { name: 'Bogor', lat: -6.5971, lng: 106.8060 },
  ];

  for (const city of cities) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🏙️  Scraping ${city.name}...`);
    console.log(`${'='.repeat(50)}\n`);
    
    await scrapeFacilities(city.lat, city.lng, 15);
    
    // Wait between cities
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Run
const args = process.argv.slice(2);

if (args.includes('--all')) {
  // Scrape all cities
  scrapeMultipleCities()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
} else {
  // Scrape single location (default: Jakarta Pusat)
  const lat = parseFloat(args[0]) || -6.1754;
  const lng = parseFloat(args[1]) || 106.8272;
  const radius = parseFloat(args[2]) || 10;

  scrapeFacilities(lat, lng, radius)
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
