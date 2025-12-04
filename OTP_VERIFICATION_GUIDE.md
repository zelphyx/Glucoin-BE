# OTP Verification Guide - Glucoin

## Fitur yang Ditambahkan

Sistem OTP (One-Time Password) untuk verifikasi email saat registrasi. User harus verifikasi email sebelum bisa login.

## Konfigurasi SMTP

Edit file `.env` dan isi dengan kredensial email Anda:

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

### Cara Mendapatkan App Password untuk Gmail:

1. Buka https://myaccount.google.com/security
2. Aktifkan 2-Step Verification
3. Buka https://myaccount.google.com/apppasswords
4. Generate App Password untuk "Mail"
5. Copy password dan paste ke `SMTP_PASS` di file `.env`

## API Endpoints

### 1. Register (dengan OTP)

**POST** `/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "full_name": "John Doe",
  "role": "USER",
  "phone_number": "08123456789"
}
```

**Response:**
```json
{
  "message": "Registration successful. Please check your email for OTP verification code.",
  "email": "user@example.com"
}
```

**Note:** User akan menerima email berisi 6-digit OTP yang valid selama 10 menit.

---

### 2. Verify OTP

**POST** `/auth/verify-otp`

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (Success):**
```json
{
  "message": "Email verified successfully",
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "USER"
  },
  "access_token": "jwt-token-here"
}
```

**Response (Error - Invalid OTP):**
```json
{
  "statusCode": 401,
  "message": "Invalid OTP code"
}
```

**Response (Error - Expired OTP):**
```json
{
  "statusCode": 401,
  "message": "OTP code has expired"
}
```

---

### 3. Resend OTP

**POST** `/auth/resend-otp`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "OTP has been resent to your email",
  "email": "user@example.com"
}
```

---

### 4. Login (Hanya untuk user yang sudah terverifikasi)

**POST** `/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (Success):**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "USER"
  },
  "access_token": "jwt-token-here"
}
```

**Response (Error - Not Verified):**
```json
{
  "statusCode": 401,
  "message": "Please verify your email before logging in"
}
```

---

## Flow Registrasi dengan OTP

```
1. User register → POST /auth/register
   ↓
2. System generate OTP & kirim ke email user
   ↓
3. User cek email & dapat OTP (6 digit)
   ↓
4. User verify OTP → POST /auth/verify-otp
   ↓
5. System verify OTP & set is_verified = true
   ↓
6. User dapat access_token & bisa login
```

## Database Changes

Field baru di tabel `User`:
- `otp_code` (String, nullable) - Kode OTP 6 digit
- `otp_expires_at` (DateTime, nullable) - Waktu expiry OTP
- `is_verified` (Boolean, default: false) - Status verifikasi email
- `email_verified_at` (DateTime, nullable) - Waktu verifikasi email

## Testing dengan cURL

### 1. Register
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "full_name": "Test User",
    "role": "USER"
  }'
```

### 2. Verify OTP (ganti dengan OTP dari email)
```bash
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456"
  }'
```

### 3. Resend OTP
```bash
curl -X POST http://localhost:3000/auth/resend-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com"
  }'
```

### 4. Login (setelah verify)
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## Security Features

- ✅ OTP valid hanya 10 menit
- ✅ OTP 6-digit random number
- ✅ User tidak bisa login sebelum verifikasi
- ✅ OTP dihapus setelah verifikasi berhasil
- ✅ Email verification timestamp disimpan

## Troubleshooting

### Email tidak terkirim?
1. Check kredensial SMTP di `.env`
2. Pastikan App Password sudah benar (bukan password biasa Gmail)
3. Check console log untuk error

### OTP expired?
1. Klik resend OTP untuk mendapat kode baru
2. OTP berlaku 10 menit sejak dikirim

### User sudah register tapi belum verify?
1. User bisa klik resend OTP
2. User tidak bisa login sampai verify email

