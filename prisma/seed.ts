import { PrismaClient } from '@glucoin/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL!;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seeding...');

  // Hash password yang akan digunakan
  const hashedPassword = await bcrypt.hash('password123', 10);

  // Clear existing data (optional - hapus jika tidak ingin reset data)
  console.log('🗑️  Clearing existing data...');
  await prisma.healthcareFacility.deleteMany();
  await prisma.orderPayment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.productReview.deleteMany();
  await prisma.product.deleteMany();
  await prisma.shippingAddress.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.doctorSchedule.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.user.deleteMany();

  // ============= SEED USERS =============
  console.log('👤 Creating users...');
  
  // Admin User
  const admin = await prisma.user.create({
    data: {
      email: 'admin@glucoin.com',
      password: 'aryakontol',
      full_name: 'Admin Glucoin',
      role: 'ADMIN',
      is_verified: true,
      email_verified_at: new Date(),
      phone_number: '+628123456789',
    },
  });

  // Regular Users
  const user1 = await prisma.user.create({
    data: {
      email: 'john.doe@gmail.com',
      password: hashedPassword,
      full_name: 'John Doe',
      role: 'USER',
      is_verified: true,
      email_verified_at: new Date(),
      date_of_birth: new Date('1990-05-15'),
      gender: 'MALE',
      weight_kg: 75.5,
      height_cm: 175,
      phone_number: '+628111222333',
      whatsapp_number: '+628111222333',
    },
  });

  const user2 = await prisma.user.create({
    data: {
      email: 'jane.smith@gmail.com',
      password: hashedPassword,
      full_name: 'Jane Smith',
      role: 'USER',
      is_verified: true,
      email_verified_at: new Date(),
      date_of_birth: new Date('1995-08-20'),
      gender: 'FEMALE',
      weight_kg: 60,
      height_cm: 165,
      phone_number: '+628222333444',
      whatsapp_number: '+628222333444',
    },
  });

  // ============= SEED DOCTORS =============
  console.log('👨‍⚕️ Creating doctors...');

  const doctorUser1 = await prisma.user.create({
    data: {
      email: 'dr.ahmad@glucoin.com',
      password: hashedPassword,
      full_name: 'Dr. Ahmad Hidayat, Sp.PD',
      role: 'DOCTOR',
      is_verified: true,
      email_verified_at: new Date(),
      gender: 'MALE',
      phone_number: '+628333444555',
    },
  });

  const doctor1 = await prisma.doctor.create({
    data: {
      user_id: doctorUser1.id,
      specialization: 'Spesialis Penyakit Dalam (Diabetes & Endokrinologi)',
      alamat_praktek: 'RS. Harapan Kita, Jakarta Barat',
      price_range: 'Rp 150.000 - Rp 300.000',
      is_available: true,
    },
  });

  const doctorUser2 = await prisma.user.create({
    data: {
      email: 'dr.sarah@glucoin.com',
      password: hashedPassword,
      full_name: 'Dr. Sarah Wijaya, Sp.PD-KEMD',
      role: 'DOCTOR',
      is_verified: true,
      email_verified_at: new Date(),
      gender: 'FEMALE',
      phone_number: '+628444555666',
    },
  });

  const doctor2 = await prisma.doctor.create({
    data: {
      user_id: doctorUser2.id,
      specialization: 'Spesialis Endokrinologi & Metabolisme',
      alamat_praktek: 'RS. Siloam Kebon Jeruk, Jakarta Barat',
      price_range: 'Rp 200.000 - Rp 400.000',
      is_available: true,
    },
  });

  const doctorUser3 = await prisma.user.create({
    data: {
      email: 'dr.budi@glucoin.com',
      password: hashedPassword,
      full_name: 'Dr. Budi Santoso, Sp.PD',
      role: 'DOCTOR',
      is_verified: true,
      email_verified_at: new Date(),
      gender: 'MALE',
      phone_number: '+628555666777',
    },
  });

  const doctor3 = await prisma.doctor.create({
    data: {
      user_id: doctorUser3.id,
      specialization: 'Spesialis Penyakit Dalam & Konsultan Diabetes',
      alamat_praktek: 'RSUD Tangerang Selatan',
      price_range: 'Rp 100.000 - Rp 250.000',
      is_available: true,
    },
  });

  // ============= SEED DOCTOR SCHEDULES =============
  console.log('📅 Creating doctor schedules...');

  // Doctor 1 Schedule (Senin - Jumat)
  const doctor1Schedules: any[] = [];
  const days: any[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  const timeSlots = ['09:00', '11:00', '13:00', '15:00', '17:00'];

  for (const day of days) {
    for (const time of timeSlots) {
      const schedule = await prisma.doctorSchedule.create({
        data: {
          doctor_id: doctor1.id,
          day_of_week: day,
          time_slot: time,
          duration_minutes: 60,
          is_active: true,
        },
      });
      doctor1Schedules.push(schedule);
    }
  }

  // Doctor 2 Schedule (Selasa - Sabtu)
  const doctor2Days: any[] = ['TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const doctor2TimeSlots = ['10:00', '13:00', '15:00', '17:00'];

  for (const day of doctor2Days) {
    for (const time of doctor2TimeSlots) {
      await prisma.doctorSchedule.create({
        data: {
          doctor_id: doctor2.id,
          day_of_week: day,
          time_slot: time,
          duration_minutes: 90,
          is_active: true,
        },
      });
    }
  }

  // Doctor 3 Schedule (Senin - Kamis, Sabtu)
  const doctor3Days: any[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'SATURDAY'];
  const doctor3TimeSlots = ['08:00', '10:00', '14:00', '16:00'];

  for (const day of doctor3Days) {
    for (const time of doctor3TimeSlots) {
      await prisma.doctorSchedule.create({
        data: {
          doctor_id: doctor3.id,
          day_of_week: day,
          time_slot: time,
          duration_minutes: 60,
          is_active: true,
        },
      });
    }
  }

  // ============= SEED BOOKINGS (SAMPLE) =============
  console.log('📝 Creating sample bookings...');

  // Get a schedule for booking
  const sampleSchedule = doctor1Schedules[0];

  const booking1 = await prisma.booking.create({
    data: {
      user_id: user1.id,
      doctor_id: doctor1.id,
      schedule_id: sampleSchedule.id,
      booking_date: new Date('2025-12-16'),
      start_time: '09:00',
      end_time: '10:00',
      duration_minutes: 60,
      consultation_type: 'OFFLINE',
      consultation_fee: 200000,
      status: 'PENDING_PAYMENT',
      payment_status: 'PENDING',
      notes: 'Konsultasi cek gula darah rutin',
    },
  });

  // Booking yang sudah dibayar
  const booking2 = await prisma.booking.create({
    data: {
      user_id: user2.id,
      doctor_id: doctor2.id,
      schedule_id: (await prisma.doctorSchedule.findFirst({
        where: { doctor_id: doctor2.id, day_of_week: 'WEDNESDAY' }
      }))!.id,
      booking_date: new Date('2025-12-18'),
      start_time: '13:00',
      end_time: '14:30',
      duration_minutes: 90,
      consultation_type: 'ONLINE',
      consultation_fee: 300000,
      status: 'CONFIRMED',
      payment_status: 'PAID',
      notes: 'Konsultasi online via Zoom',
    },
  });

  // ============= SEED PAYMENTS =============
  console.log('💳 Creating sample payments...');

  await prisma.payment.create({
    data: {
      booking_id: booking1.id,
      order_id: `ORDER-${Date.now()}-1`,
      amount: 200000,
      status: 'PENDING',
      snap_token: 'sample-snap-token-123',
      snap_redirect_url: 'https://app.midtrans.com/snap/v1/pay/sample-snap-token-123',
    },
  });

  await prisma.payment.create({
    data: {
      booking_id: booking2.id,
      order_id: `ORDER-${Date.now()}-2`,
      amount: 300000,
      payment_type: 'bank_transfer',
      transaction_id: 'TXN-123456789',
      transaction_status: 'settlement',
      transaction_time: new Date(),
      status: 'PAID',
      bank: 'BCA',
      va_number: '8123456789012345',
    },
  });

  // ============= SEED MARKETPLACE PRODUCTS =============
  console.log('🛒 Creating marketplace products...');

  const products = [
    {
      name: 'Glucometer Digital GlucoCheck Pro',
      description: 'Alat ukur gula darah digital dengan akurasi tinggi. Dilengkapi layar LCD besar dan memori 500 hasil tes.',
      price: 350000,
      discount_percent: 10,
      quantity: 50,
      image_url: 'https://example.com/glucometer.jpg',
      category: 'MEDICAL_DEVICE',
    },
    {
      name: 'Test Strip Gula Darah (50 pcs)',
      description: 'Strip tes gula darah kompatibel dengan GlucoCheck Pro. Akurasi 99%.',
      price: 150000,
      discount_percent: 0,
      quantity: 200,
      image_url: 'https://example.com/test-strip.jpg',
      category: 'MEDICAL_DEVICE',
    },
    {
      name: 'Suplemen Diabetasol 180g',
      description: 'Suplemen nutrisi khusus untuk penderita diabetes. Rendah gula, tinggi serat.',
      price: 95000,
      discount_percent: 15,
      quantity: 100,
      image_url: 'https://example.com/diabetasol.jpg',
      category: 'SUPPLEMENT',
    },
    {
      name: 'Tropicana Slim Sweetener (100 sachet)',
      description: 'Pemanis rendah kalori pengganti gula. Aman untuk penderita diabetes.',
      price: 75000,
      discount_percent: 5,
      quantity: 150,
      image_url: 'https://example.com/tropicana.jpg',
      category: 'FOOD_DRINK',
    },
    {
      name: 'Metformin 500mg (30 tablet)',
      description: 'Obat diabetes oral untuk mengontrol kadar gula darah. Harus dengan resep dokter.',
      price: 45000,
      discount_percent: 0,
      quantity: 80,
      image_url: 'https://example.com/metformin.jpg',
      category: 'MEDICINE',
    },
    {
      name: 'Insulin Pen NovoRapid',
      description: 'Pen insulin untuk injeksi mandiri. Mudah digunakan dan praktis dibawa.',
      price: 550000,
      discount_percent: 0,
      quantity: 30,
      image_url: 'https://example.com/insulin-pen.jpg',
      category: 'MEDICINE',
    },
    {
      name: 'Jarum Insulin (100 pcs)',
      description: 'Jarum insulin steril sekali pakai. Ukuran 31G x 6mm.',
      price: 120000,
      discount_percent: 10,
      quantity: 100,
      image_url: 'https://example.com/insulin-needle.jpg',
      category: 'MEDICAL_DEVICE',
    },
    {
      name: 'Susu Diabetasol 600g',
      description: 'Susu formula khusus untuk penderita diabetes. Rendah GI, tinggi protein.',
      price: 185000,
      discount_percent: 20,
      quantity: 60,
      image_url: 'https://example.com/susu-diabetasol.jpg',
      category: 'FOOD_DRINK',
    },
  ];

  for (const product of products) {
    const final_price = product.price - (product.price * product.discount_percent) / 100;
    await prisma.product.create({
      data: {
        ...product,
        final_price,
        category: product.category as any,
      },
    });
  }

  // ============= SEED HEALTHCARE FACILITIES =============
  console.log('🏥 Creating healthcare facilities...');

  // Data fasilitas kesehatan di area Jakarta (centered around -6.2088, 106.8456)
  const facilities = [
    // RUMAH SAKIT
    {
      name: 'RS Cipto Mangunkusumo',
      type: 'HOSPITAL',
      address: 'Jl. Diponegoro No.71, Salemba',
      city: 'Jakarta Pusat',
      province: 'DKI Jakarta',
      phone: '021-1500135',
      latitude: -6.1977,
      longitude: 106.8459,
      is_open_24h: true,
      rating: 4.5,
    },
    {
      name: 'RS Pondok Indah',
      type: 'HOSPITAL',
      address: 'Jl. Metro Duta Kav. UE, Pondok Indah',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      phone: '021-7657525',
      latitude: -6.2746,
      longitude: 106.7856,
      is_open_24h: true,
      rating: 4.7,
    },
    {
      name: 'RSUP Fatmawati',
      type: 'HOSPITAL',
      address: 'Jl. RS Fatmawati Raya No.4',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      phone: '021-7501524',
      latitude: -6.2924,
      longitude: 106.7968,
      is_open_24h: true,
      rating: 4.3,
    },
    {
      name: 'RS Medistra',
      type: 'HOSPITAL',
      address: 'Jl. Gatot Subroto Kav.59',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      phone: '021-5210200',
      latitude: -6.2351,
      longitude: 106.8281,
      is_open_24h: true,
      rating: 4.6,
    },
    {
      name: 'RS Jakarta',
      type: 'HOSPITAL',
      address: 'Jl. Jend. Sudirman Kav.49',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      phone: '021-5732241',
      latitude: -6.2242,
      longitude: 106.8097,
      is_open_24h: true,
      rating: 4.4,
    },
    // APOTEK
    {
      name: 'Apotek Kimia Farma Sarinah',
      type: 'PHARMACY',
      address: 'Jl. M.H. Thamrin No.11',
      city: 'Jakarta Pusat',
      province: 'DKI Jakarta',
      phone: '021-3143128',
      latitude: -6.1871,
      longitude: 106.8235,
      is_open_24h: true,
      rating: 4.2,
    },
    {
      name: 'Apotek Century Healthcare Sudirman',
      type: 'PHARMACY',
      address: 'Wisma GKBI, Jl. Jend. Sudirman No.28',
      city: 'Jakarta Pusat',
      province: 'DKI Jakarta',
      phone: '021-5743536',
      latitude: -6.2113,
      longitude: 106.8183,
      is_open_24h: false,
      opening_time: '07:00',
      closing_time: '22:00',
      rating: 4.3,
    },
    {
      name: 'Apotek K-24 Senayan',
      type: 'PHARMACY',
      address: 'Jl. Asia Afrika No.8, Senayan',
      city: 'Jakarta Pusat',
      province: 'DKI Jakarta',
      phone: '021-57851324',
      latitude: -6.2191,
      longitude: 106.8021,
      is_open_24h: true,
      rating: 4.4,
    },
    {
      name: 'Apotek Guardian Plaza Indonesia',
      type: 'PHARMACY',
      address: 'Plaza Indonesia, Jl. M.H. Thamrin',
      city: 'Jakarta Pusat',
      province: 'DKI Jakarta',
      phone: '021-29923750',
      latitude: -6.1934,
      longitude: 106.8217,
      is_open_24h: false,
      opening_time: '10:00',
      closing_time: '22:00',
      rating: 4.5,
    },
    {
      name: 'Apotek Viva Generik Kuningan',
      type: 'PHARMACY',
      address: 'Jl. H.R. Rasuna Said Kav.B2',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      phone: '021-52901232',
      latitude: -6.2281,
      longitude: 106.8356,
      is_open_24h: false,
      opening_time: '08:00',
      closing_time: '21:00',
      rating: 4.1,
    },
    // KLINIK
    {
      name: 'Klinik Prodia Kramat',
      type: 'CLINIC',
      address: 'Jl. Kramat Raya No.150',
      city: 'Jakarta Pusat',
      province: 'DKI Jakarta',
      phone: '021-3909000',
      latitude: -6.1850,
      longitude: 106.8521,
      is_open_24h: false,
      opening_time: '07:00',
      closing_time: '20:00',
      rating: 4.6,
    },
    {
      name: 'Klinik Halodoc Menteng',
      type: 'CLINIC',
      address: 'Jl. HOS Cokroaminoto No.36, Menteng',
      city: 'Jakarta Pusat',
      province: 'DKI Jakarta',
      phone: '021-50816060',
      latitude: -6.1962,
      longitude: 106.8371,
      is_open_24h: false,
      opening_time: '08:00',
      closing_time: '21:00',
      rating: 4.5,
    },
    {
      name: 'Klinik Medika Plaza',
      type: 'CLINIC',
      address: 'Jl. Gatot Subroto Kav.36-38',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      phone: '021-5226070',
      latitude: -6.2391,
      longitude: 106.8271,
      is_open_24h: false,
      opening_time: '08:00',
      closing_time: '20:00',
      rating: 4.3,
    },
    {
      name: 'Klinik Parahita Senayan',
      type: 'CLINIC',
      address: 'Ratu Plaza, Jl. Jend. Sudirman Kav.9',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      phone: '021-7203400',
      latitude: -6.2272,
      longitude: 106.7981,
      is_open_24h: false,
      opening_time: '07:30',
      closing_time: '17:00',
      rating: 4.4,
    },
    // PUSKESMAS
    {
      name: 'Puskesmas Kecamatan Menteng',
      type: 'PUSKESMAS',
      address: 'Jl. Pegangsaan Barat No.28',
      city: 'Jakarta Pusat',
      province: 'DKI Jakarta',
      phone: '021-31937915',
      latitude: -6.1988,
      longitude: 106.8412,
      is_open_24h: false,
      opening_time: '08:00',
      closing_time: '16:00',
      rating: 4.0,
    },
    {
      name: 'Puskesmas Kecamatan Kebayoran Baru',
      type: 'PUSKESMAS',
      address: 'Jl. Sisingamangaraja No.40',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      phone: '021-7221143',
      latitude: -6.2432,
      longitude: 106.7987,
      is_open_24h: false,
      opening_time: '08:00',
      closing_time: '16:00',
      rating: 4.1,
    },
    {
      name: 'Puskesmas Kecamatan Setiabudi',
      type: 'PUSKESMAS',
      address: 'Jl. Setiabudi Barat No.1',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      phone: '021-5252043',
      latitude: -6.2211,
      longitude: 106.8321,
      is_open_24h: false,
      opening_time: '08:00',
      closing_time: '16:00',
      rating: 4.2,
    },
    // LABORATORIUM
    {
      name: 'Laboratorium Prodia Tebet',
      type: 'LAB',
      address: 'Jl. Prof. Dr. Supomo No.25',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      phone: '021-8298674',
      latitude: -6.2433,
      longitude: 106.8567,
      is_open_24h: false,
      opening_time: '06:00',
      closing_time: '21:00',
      rating: 4.7,
    },
    {
      name: 'Laboratorium Biotest Kuningan',
      type: 'LAB',
      address: 'Jl. Prof. Dr. Satrio Kav.3',
      city: 'Jakarta Selatan',
      province: 'DKI Jakarta',
      phone: '021-5205150',
      latitude: -6.2289,
      longitude: 106.8289,
      is_open_24h: false,
      opening_time: '07:00',
      closing_time: '19:00',
      rating: 4.5,
    },
    {
      name: 'Laboratorium Pramita Cikini',
      type: 'LAB',
      address: 'Jl. Cikini Raya No.60',
      city: 'Jakarta Pusat',
      province: 'DKI Jakarta',
      phone: '021-3107676',
      latitude: -6.1886,
      longitude: 106.8396,
      is_open_24h: false,
      opening_time: '06:00',
      closing_time: '20:00',
      rating: 4.6,
    },
  ];

  for (const facility of facilities) {
    await prisma.healthcareFacility.create({
      data: {
        ...facility,
        type: facility.type as any,
      },
    });
  }

  console.log('✅ Seeding completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Users: ${await prisma.user.count()}`);
  console.log(`   - Doctors: ${await prisma.doctor.count()}`);
  console.log(`   - Doctor Schedules: ${await prisma.doctorSchedule.count()}`);
  console.log(`   - Bookings: ${await prisma.booking.count()}`);
  console.log(`   - Payments: ${await prisma.payment.count()}`);
  console.log(`   - Products: ${await prisma.product.count()}`);
  console.log(`   - Healthcare Facilities: ${await prisma.healthcareFacility.count()}`);
  console.log('\n🔑 Login credentials (all passwords: password123):');
  console.log('   - Admin: admin@glucoin.com');
  console.log('   - User 1: john.doe@gmail.com');
  console.log('   - User 2: jane.smith@gmail.com');
  console.log('   - Doctor 1: dr.ahmad@glucoin.com');
  console.log('   - Doctor 2: dr.sarah@glucoin.com');
  console.log('   - Doctor 3: dr.budi@glucoin.com');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
