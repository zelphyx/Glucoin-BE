/**
 * Script untuk scrape Semarang dan kota lain
 * Usage: npx ts-node scripts/scrape-semarang.ts
 */

import { PrismaClient } from '@glucoin/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

async function queryOverpass(lat: number, lon: number, radiusMeters: number) {
  const query = `
    [out:json][timeout:60];
    (
      node["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      way["amenity"="hospital"](around:${radiusMeters},${lat},${lon});
      node["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
      way["amenity"="pharmacy"](around:${radiusMeters},${lat},${lon});
      node["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
      way["amenity"="clinic"](around:${radiusMeters},${lat},${lon});
      node["amenity"="doctors"](around:${radiusMeters},${lat},${lon});
      node["healthcare"](around:${radiusMeters},${lat},${lon});
      way["healthcare"](around:${radiusMeters},${lat},${lon});
    );
    out center;
  `;

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  const data = await response.json();
  return data.elements || [];
}

function mapType(el: any): string | null {
  const amenity = el.tags?.amenity;
  const healthcare = el.tags?.healthcare;
  
  if (amenity === 'hospital' || healthcare === 'hospital') return 'HOSPITAL';
  if (amenity === 'pharmacy') return 'PHARMACY';
  if (amenity === 'clinic' || healthcare === 'clinic' || amenity === 'doctors' || healthcare === 'doctor') return 'CLINIC';
  if (healthcare === 'laboratory') return 'LAB';
  return null;
}

async function scrape(lat: number, lon: number, radius: number, city: string, province: string) {
  console.log(`\n🔍 Scraping ${city}, ${province}...`);
  
  const elements = await queryOverpass(lat, lon, radius * 1000);
  console.log(`📊 Found ${elements.length} elements from OSM`);
  
  let saved = 0;
  
  for (const el of elements) {
    const name = el.tags?.name;
    if (!name) continue;
    
    const type = mapType(el);
    if (!type) continue;
    
    const elLat = el.lat || el.center?.lat;
    const elLon = el.lon || el.center?.lon;
    if (!elLat || !elLon) continue;
    
    const id = `osm_${el.type}_${el.id}`;
    const address = el.tags?.['addr:full'] || el.tags?.['addr:street'] || 'Alamat tidak tersedia';
    const phone = el.tags?.phone || el.tags?.['contact:phone'] || null;
    
    try {
      await prisma.healthcareFacility.upsert({
        where: { id },
        update: {
          name,
          type: type as any,
          address,
          city,
          province,
          phone,
          latitude: elLat,
          longitude: elLon,
          updated_at: new Date(),
        },
        create: {
          id,
          name,
          type: type as any,
          address,
          city,
          province,
          phone,
          latitude: elLat,
          longitude: elLon,
          rating: 0,
          rating_count: 0,
          is_open_24h: false,
        },
      });
      saved++;
      console.log(`✅ ${name} (${type})`);
    } catch (error: any) {
      console.error(`❌ Error saving ${name}:`, error.message);
    }
  }
  
  console.log(`\n📈 Saved ${saved} facilities in ${city}`);
  return saved;
}

async function main() {
  const cities = [
    // Jawa Tengah
    { name: 'Semarang', province: 'Jawa Tengah', lat: -7.0051, lon: 110.4381 },
    { name: 'Semarang Selatan', province: 'Jawa Tengah', lat: -7.0504, lon: 110.4450 },
    { name: 'Solo', province: 'Jawa Tengah', lat: -7.5755, lon: 110.8243 },
    
    // Jawa Timur  
    { name: 'Surabaya', province: 'Jawa Timur', lat: -7.2575, lon: 112.7521 },
    { name: 'Malang', province: 'Jawa Timur', lat: -7.9786, lon: 112.6308 },
    
    // Jawa Barat
    { name: 'Bandung', province: 'Jawa Barat', lat: -6.9175, lon: 107.6191 },
    
    // DI Yogyakarta
    { name: 'Yogyakarta', province: 'DI Yogyakarta', lat: -7.7956, lon: 110.3695 },
    
    // Bali
    { name: 'Denpasar', province: 'Bali', lat: -8.6705, lon: 115.2126 },
    
    // Sumatera
    { name: 'Medan', province: 'Sumatera Utara', lat: 3.5952, lon: 98.6722 },
    { name: 'Palembang', province: 'Sumatera Selatan', lat: -2.9761, lon: 104.7754 },
    
    // Sulawesi
    { name: 'Makassar', province: 'Sulawesi Selatan', lat: -5.1477, lon: 119.4327 },
  ];

  let totalSaved = 0;

  for (const city of cities) {
    try {
      const saved = await scrape(city.lat, city.lon, 15, city.name, city.province);
      totalSaved += saved;
      
      // Rate limiting
      console.log('⏳ Waiting 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error(`Error scraping ${city.name}:`, error);
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`🎉 SCRAPING COMPLETED!`);
  console.log(`Total saved: ${totalSaved}`);
  console.log(`Total in DB: ${await prisma.healthcareFacility.count()}`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
