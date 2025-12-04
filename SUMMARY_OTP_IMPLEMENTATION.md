# Summary - OTP Verification Implementation

## ✅ Perubahan yang Sudah Dilakukan

### 1. Database Schema (Prisma)
**File:** `prisma/schema.prisma`

Ditambahkan field baru di model User:
```prisma
otp_code            String?
otp_expires_at      DateTime?
```

Field yang sudah ada sebelumnya:
- `is_verified` (Boolean, default: false)
- `email_verified_at` (DateTime?)

**Migration:** `20251203064053_add_otp_fields`

---

### 2. DTOs (Data Transfer Objects)

#### a. VerifyOtpDto
**File:** `src/auth/dto/verify-otp.dto.ts`
```typescript
{
  email: string;
  otp: string; // 6 digit
}
```

#### b. ResendOtpDto
**File:** `src/auth/dto/resend-otp.dto.ts`
```typescript
{
  email: string;
}
```

---

### 3. Auth Service
**File:** `src/auth/auth.service.ts`

**Methods yang ditambahkan:**

1. **`verifyOtp(verifyOtpDto)`**
   - Validasi OTP code
   - Check expiry time (10 menit)
   - Set `is_verified = true`
   - Return JWT token

2. **`resendOtp(resendOtpDto)`**
   - Generate OTP baru
   - Update `otp_code` dan `otp_expires_at`
   - Kirim email baru

3. **`sendOtpEmail(email, fullName, otp)`** (private)
   - Kirim email menggunakan nodemailer
   - Template HTML dengan OTP 6 digit
   - Error handling (tidak throw error)

**Methods yang diupdate:**

1. **`register(registerDto)`**
   - Generate OTP 6-digit random
   - Set `otp_expires_at` (10 menit dari sekarang)
   - Set `is_verified = false`
   - Kirim OTP via email
   - Return message (tidak langsung return token)

2. **`login(loginDto)`**
   - Tambah validasi: `if (!user.is_verified)` throw error
   - User harus verify email sebelum bisa login

**Setup Nodemailer:**
```typescript
transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});
```

---

### 4. Auth Controller
**File:** `src/auth/auth.controller.ts`

**Endpoints yang ditambahkan:**

1. **POST** `/auth/verify-otp`
   - Body: `{ email, otp }`
   - Response: User data + JWT token

2. **POST** `/auth/resend-otp`
   - Body: `{ email }`
   - Response: Success message

**Endpoints yang sudah ada:**
- POST `/auth/register` (updated behavior)
- POST `/auth/login` (updated validation)

---

### 5. Environment Variables
**File:** `.env`

Ditambahkan:
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
```

---

### 6. Dependencies
**Package yang diinstall:**
```json
{
  "nodemailer": "^6.x.x",
  "@types/nodemailer": "^6.x.x"
}
```

---

## 📋 Flow Lengkap

### Registration Flow:
```
1. POST /auth/register
   → User input: email, password, full_name, role
   
2. System:
   → Hash password
   → Generate OTP (6-digit)
   → Set otp_expires_at (now + 10 min)
   → Save to database with is_verified = false
   → Send email with OTP
   
3. Response:
   → Message: "Check your email for OTP"
   → Email address
```

### Verification Flow:
```
1. User receives email with OTP (e.g., 123456)

2. POST /auth/verify-otp
   → Body: { email, otp: "123456" }
   
3. System:
   → Find user by email
   → Check OTP match
   → Check not expired (< 10 min)
   → Set is_verified = true
   → Set email_verified_at = now
   → Clear otp_code & otp_expires_at
   → Generate JWT token
   
4. Response:
   → User data
   → JWT access_token
```

### Login Flow:
```
1. POST /auth/login
   → Body: { email, password }
   
2. System:
   → Validate credentials
   → CHECK: is_verified === true ← BARU!
   → If not verified: throw error
   → Update last_login_at
   → Generate JWT token
   
3. Response:
   → User data
   → JWT access_token
```

### Resend OTP Flow:
```
1. POST /auth/resend-otp
   → Body: { email }
   
2. System:
   → Find user
   → Check not already verified
   → Generate new OTP
   → Update otp_expires_at
   → Send new email
   
3. Response:
   → Message: "OTP resent"
```

---

## 🔐 Security Features

1. **OTP Expiry**: 10 menit dari generate
2. **Random 6-digit**: 100000 - 999999
3. **One-time use**: OTP dihapus setelah verified
4. **Login Protection**: User tidak bisa login sebelum verify
5. **Email Validation**: class-validator untuk format email
6. **Password Hashing**: bcrypt sebelum save

---

## 🧪 Testing

### Test Registration:
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

Expected: 
- Response message "check email"
- Email diterima dengan OTP 6-digit

### Test Verify OTP:
```bash
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456"
  }'
```

Expected:
- Response dengan user data + JWT token
- Database: is_verified = true

### Test Login (Before Verify):
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Expected: Error "Please verify your email before logging in"

### Test Login (After Verify):
Same command, Expected: Success dengan JWT token

---

## 📧 Email Template

Subject: **Email Verification - Glucoin**

Body:
```
Welcome to Glucoin, {fullName}!

Thank you for registering. Please use the following OTP code to verify your email:

┌────────────────┐
│    123456      │  ← OTP 6-digit
└────────────────┘

This OTP will expire in 10 minutes.

If you didn't request this, please ignore this email.
```

---

## ⚙️ Configuration Required

**Before running:**

1. Edit `.env` file
2. Set SMTP credentials (Gmail recommended)
3. For Gmail: Use App Password, not regular password
4. Run `npx prisma migrate dev` (already done)
5. Run `npm run start:dev`

---

## 🎯 Next Steps (Optional)

1. Add rate limiting untuk prevent spam OTP
2. Add cooldown period untuk resend OTP (e.g., 1 menit)
3. Add OTP retry limit (max 3x salah)
4. Add email template yang lebih cantik
5. Add SMS OTP sebagai alternatif
6. Add forgot password dengan OTP
7. Add notification service (separate microservice)

---

## 📁 File Changes Summary

### Created:
- `src/auth/dto/verify-otp.dto.ts`
- `src/auth/dto/resend-otp.dto.ts`
- `OTP_VERIFICATION_GUIDE.md`
- `SUMMARY.md` (this file)

### Modified:
- `prisma/schema.prisma` (added otp fields)
- `src/auth/auth.service.ts` (added OTP methods)
- `src/auth/auth.controller.ts` (added OTP endpoints)
- `.env` (added SMTP config)

### Database:
- Migration: `20251203064053_add_otp_fields`

---

## ✅ Status: COMPLETE

Semua fitur OTP verification sudah diimplementasikan dan siap digunakan!

