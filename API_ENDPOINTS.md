# Glucoin API Endpoints Documentation

> **Base URL:** `http://your-server.com/api` (atau sesuai konfigurasi server)

---

## 📋 Daftar Isi

1. [Authentication](#1-authentication)
2. [Doctors](#2-doctors)
3. [Booking](#3-booking)
4. [Payment](#4-payment)
5. [Marketplace](#5-marketplace)
6. [Facilities](#6-facilities)
7. [Health / Reminders](#7-health--reminders)

---

## 1. Authentication

### POST `/auth/register`
Registrasi user baru (perlu verifikasi OTP).

```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "full_name": "John Doe",
  "role": "PATIENT",
  "phone_number": "081234567890"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | string | ✅ | Email valid |
| password | string | ✅ | Min 6 karakter |
| full_name | string | ✅ | |
| role | enum | ✅ | `PATIENT`, `DOCTOR`, `ADMIN` |
| phone_number | string | ❌ | Format: 08xx atau 62xx |

---

### POST `/auth/verify-otp`
Verifikasi OTP setelah registrasi.

```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | string | ✅ | |
| otp | string | ✅ | 6 digit |

---

### POST `/auth/resend-otp`
Kirim ulang OTP.

```json
{
  "email": "user@example.com"
}
```

---

### POST `/auth/login`
Login user.

```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:** JWT token

---

### POST `/auth/forgot-password`
Request reset password (kirim link ke email).

```json
{
  "email": "user@example.com"
}
```

---

### POST `/auth/reset-password`
Reset password dengan token.

```json
{
  "token": "reset-token-from-email",
  "newPassword": "newSecurePassword123",
  "confirmPassword": "newSecurePassword123",
  "confirmReset": true
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| token | string | ✅ | Token dari URL reset |
| newPassword | string | ✅ | Min 6 karakter |
| confirmPassword | string | ✅ | Harus sama dengan newPassword |
| confirmReset | boolean | ✅ | Harus `true` |

---

## 2. Doctors

### POST `/doctors`
Buat profil dokter baru (Admin only).

```json
{
  "user_id": "uuid-user-id",
  "specialization": "Endocrinology",
  "alamat_praktek": "RS Diabetes Center, Jl. Kesehatan No. 1",
  "price_range": "150000-300000",
  "is_available": true,
  "schedules": [
    {
      "day_of_week": "MONDAY",
      "time_slot": "09:00",
      "duration_minutes": 30,
      "is_active": true
    },
    {
      "day_of_week": "WEDNESDAY",
      "time_slot": "14:00",
      "duration_minutes": 30,
      "is_active": true
    }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| user_id | UUID | ✅ | ID user dengan role DOCTOR |
| specialization | string | ✅ | |
| alamat_praktek | string | ✅ | |
| price_range | string | ✅ | Format: "min-max" |
| is_available | boolean | ❌ | Default: true |
| schedules | array | ❌ | Array of schedule objects |

**Schedule Object:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| day_of_week | enum | ✅ | `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY` |
| time_slot | string | ✅ | Format: "HH:mm" (24 jam) |
| duration_minutes | int | ❌ | Default: 30, min: 15 |
| is_active | boolean | ❌ | Default: true |

---

### POST `/doctors/:id/schedules`
Tambah jadwal ke dokter.

```json
{
  "schedules": [
    {
      "day_of_week": "FRIDAY",
      "time_slot": "10:00",
      "duration_minutes": 45,
      "is_active": true
    }
  ]
}
```

---

## 3. Booking

### POST `/bookings`
Buat booking konsultasi baru. **🔒 Requires Auth**

```json
{
  "doctor_id": "uuid-doctor-id",
  "schedule_id": "uuid-schedule-id",
  "booking_date": "2025-12-20",
  "start_time": "09:00",
  "end_time": "09:30",
  "duration_minutes": 30,
  "consultation_type": "ONLINE",
  "consultation_fee": 150000,
  "notes": "Konsultasi rutin cek gula darah"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| doctor_id | UUID | ✅ | |
| schedule_id | UUID | ✅ | |
| booking_date | date | ✅ | Format: "YYYY-MM-DD" |
| start_time | string | ✅ | Format: "HH:mm" |
| end_time | string | ✅ | Format: "HH:mm" |
| duration_minutes | int | ✅ | Min: 15 |
| consultation_type | enum | ✅ | `ONLINE`, `OFFLINE` |
| consultation_fee | int | ✅ | Min: 0 |
| notes | string | ❌ | |

---

## 4. Payment

### POST `/payment/create/:bookingId`
Buat payment untuk booking (Midtrans). **🔒 Requires Auth**

```json
// No body required - uses booking data
```

**Response:**
```json
{
  "orderId": "BOOK-xxxxx",
  "snapToken": "midtrans-snap-token",
  "redirectUrl": "https://app.sandbox.midtrans.com/snap/v2/vtweb/..."
}
```

---

### POST `/payment/notification`
Webhook dari Midtrans (jangan dipanggil manual).

---

### POST `/payment/cancel/:orderId`
Cancel payment order.

```json
// No body required
```

---

## 5. Marketplace

### POST `/marketplace/products`
Buat produk baru (Admin only). **🔒 Requires Auth (ADMIN)**

```json
{
  "name": "Glucometer Digital",
  "description": "Alat ukur gula darah digital dengan akurasi tinggi",
  "price": 250000,
  "discount_percent": 10,
  "quantity": 50,
  "image_url": "https://example.com/product.jpg",
  "category": "MEDICAL_DEVICE"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | ✅ | |
| description | string | ✅ | |
| price | int | ✅ | Min: 0 |
| discount_percent | int | ❌ | 0-100, default: 0 |
| quantity | int | ✅ | Min: 0 |
| image_url | string | ❌ | Valid URL |
| category | enum | ✅ | `SUPPLEMENT`, `MEDICINE`, `MEDICAL_DEVICE`, `FOOD_DRINK`, `OTHER` |

---

### POST `/marketplace/cart`
Tambah item ke keranjang. **🔒 Requires Auth**

```json
{
  "product_id": "uuid-product-id",
  "quantity": 2
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| product_id | UUID | ✅ | |
| quantity | int | ✅ | Min: 1 |

---

### POST `/marketplace/addresses`
Tambah alamat pengiriman. **🔒 Requires Auth**

```json
{
  "recipient_name": "John Doe",
  "phone_number": "081234567890",
  "address": "Jl. Sehat No. 123, RT 01/RW 02",
  "city": "Jakarta Selatan",
  "province": "DKI Jakarta",
  "postal_code": "12345",
  "is_default": true
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| recipient_name | string | ✅ | |
| phone_number | string | ✅ | |
| address | string | ✅ | |
| city | string | ✅ | |
| province | string | ✅ | |
| postal_code | string | ✅ | |
| is_default | boolean | ❌ | Default: false |

---

### POST `/marketplace/orders`
Buat order dari keranjang. **🔒 Requires Auth**

```json
{
  "shipping_address_id": "uuid-address-id",
  "shipping_cost": 15000,
  "courier": "JNE",
  "notes": "Tolong packing yang rapi"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| shipping_address_id | UUID | ✅ | |
| shipping_cost | int | ✅ | Min: 0 |
| courier | string | ❌ | JNE, JNT, SiCepat, dll |
| notes | string | ❌ | |

---

### POST `/marketplace/products/:id/review`
Beri review produk setelah pembelian. **🔒 Requires Auth**

```json
{
  "rating": 5,
  "comment": "Produk bagus, pengiriman cepat!"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| rating | int | ✅ | 1-5 |
| comment | string | ❌ | |

---

### POST `/marketplace/payment/notification`
Webhook Midtrans untuk marketplace (jangan dipanggil manual).

---

## 6. Facilities

### POST `/facilities`
Tambah fasilitas kesehatan. **🔒 Requires Auth (ADMIN)**

```json
{
  "name": "RS Diabetes Center",
  "type": "HOSPITAL",
  "address": "Jl. Kesehatan No. 1",
  "city": "Jakarta",
  "province": "DKI Jakarta",
  "phone": "021-12345678",
  "latitude": -6.2088,
  "longitude": 106.8456,
  "image_url": "https://example.com/hospital.jpg",
  "is_open_24h": true,
  "opening_time": "00:00",
  "closing_time": "23:59"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| name | string | ✅ | |
| type | enum | ✅ | `HOSPITAL`, `PHARMACY`, `CLINIC`, `PUSKESMAS`, `LAB` |
| address | string | ✅ | |
| city | string | ✅ | |
| province | string | ✅ | |
| phone | string | ❌ | |
| latitude | float | ✅ | |
| longitude | float | ✅ | |
| image_url | string | ❌ | |
| is_open_24h | boolean | ❌ | |
| opening_time | string | ❌ | Format: "HH:mm" |
| closing_time | string | ❌ | Format: "HH:mm" |

---

### POST `/facilities/scrape`
Scrape data dari OpenStreetMap. **🔒 Requires Auth (ADMIN)**

```json
// No body required
```

---

## 7. Health / Reminders

### POST `/health/reminders`
Buat reminder baru. **🔒 Requires Auth**

```json
{
  "type": "GLUCOSE_CHECK",
  "title": "Cek Gula Darah Pagi",
  "message": "Waktunya cek gula darah pagi sebelum makan!",
  "time": "07:00",
  "days": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
  "is_active": true
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| type | enum | ✅ | `GLUCOSE_CHECK`, `MEDICATION`, `INSULIN`, `EXERCISE`, `APPOINTMENT`, `CUSTOM` |
| title | string | ✅ | |
| message | string | ✅ | |
| time | string | ✅ | Format: "HH:mm" |
| days | array | ✅ | Array of days atau `["EVERYDAY"]` |
| is_active | boolean | ❌ | Default: true |

**Days values:** `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY` atau `EVERYDAY`

---

### POST `/health/reminders/setup-default`
Setup reminder default untuk user diabetes. **🔒 Requires Auth**

```json
// No body required
```

**Creates:**
- ⏰ 07:00 - Cek Gula Darah Puasa
- ⏰ 08:00 - Minum Obat Pagi
- ⏰ 12:30 - Cek Gula Darah Setelah Makan Siang
- ⏰ 18:00 - Jalan Kaki Sore
- ⏰ 20:00 - Minum Obat Malam
- ⏰ 22:00 - Cek Gula Darah Sebelum Tidur

---

### POST `/health/glucose`
Catat log gula darah. **🔒 Requires Auth**

```json
{
  "glucose_level": 120,
  "category": "FASTING",
  "measured_at": "2025-12-14T07:00:00Z",
  "notes": "Sebelum sarapan"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| glucose_level | int | ✅ | 20-600 mg/dL |
| category | enum | ✅ | `FASTING`, `BEFORE_MEAL`, `AFTER_MEAL`, `RANDOM`, `BEDTIME` |
| measured_at | datetime | ❌ | ISO 8601, default: now |
| notes | string | ❌ | |

**Glucose Level Reference:**
- 🟢 Normal: < 100 mg/dL (puasa), < 140 mg/dL (setelah makan)
- 🟡 Pre-diabetes: 100-125 mg/dL (puasa)
- 🔴 Diabetes: ≥ 126 mg/dL (puasa), ≥ 200 mg/dL (random)

---

### POST `/health/medication`
Catat log konsumsi obat. **🔒 Requires Auth**

```json
{
  "medication_name": "Metformin",
  "dosage": "500mg",
  "taken_at": "2025-12-14T08:00:00Z",
  "notes": "Setelah sarapan"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| medication_name | string | ✅ | |
| dosage | string | ✅ | |
| taken_at | datetime | ❌ | ISO 8601, default: now |
| notes | string | ❌ | |

---

### POST `/health/test-notification`
Test kirim notifikasi WhatsApp. **🔒 Requires Auth**

```json
// No body required - sends test message to user's phone
```

---

## 🔐 Authentication Notes

- Endpoints dengan **🔒 Requires Auth** membutuhkan header:
  ```
  Authorization: Bearer <jwt-token>
  ```
- Role-based access:
  - `PATIENT` - Akses fitur pasien (booking, health tracking)
  - `DOCTOR` - Akses dashboard dokter + statistik
  - `ADMIN` - Full access

---

## 📱 Frontend Fetch Example

```typescript
// Login
const login = async (email: string, password: string) => {
  const response = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return response.json();
};

// Create Booking (with auth)
const createBooking = async (token: string, data: CreateBookingDto) => {
  const response = await fetch('/bookings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  return response.json();
};

// Log Glucose
const logGlucose = async (token: string, data: CreateGlucoseLogDto) => {
  const response = await fetch('/health/glucose', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(data)
  });
  return response.json();
};
```

---

## 📊 Enum Values Reference

### ConsultationType
- `ONLINE`
- `OFFLINE`

### DayOfWeek
- `MONDAY`, `TUESDAY`, `WEDNESDAY`, `THURSDAY`, `FRIDAY`, `SATURDAY`, `SUNDAY`

### FacilityType
- `HOSPITAL`, `PHARMACY`, `CLINIC`, `PUSKESMAS`, `LAB`

### ProductCategory
- `SUPPLEMENT`, `MEDICINE`, `MEDICAL_DEVICE`, `FOOD_DRINK`, `OTHER`

### ReminderType
- `GLUCOSE_CHECK`, `MEDICATION`, `INSULIN`, `EXERCISE`, `APPOINTMENT`, `CUSTOM`

### GlucoseCategory
- `FASTING`, `BEFORE_MEAL`, `AFTER_MEAL`, `RANDOM`, `BEDTIME`

### DiabetesType
- `TYPE_1`, `TYPE_2`, `GESTATIONAL`, `PRE_DIABETES`

### ShippingStatus
- `NOT_SHIPPED`, `PROCESSING`, `SHIPPED`, `IN_TRANSIT`, `DELIVERED`

### Role
- `PATIENT`, `DOCTOR`, `ADMIN`
