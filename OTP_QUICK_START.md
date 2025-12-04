# 🔐 OTP Verification - Quick Start

## ✅ Sudah Diimplementasikan

Fitur OTP verification untuk email sudah berhasil ditambahkan ke sistem registrasi Glucoin!

## 🚀 Cara Menggunakan

### 1. Setup SMTP (Gmail)

Edit file `.env`:
```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-gmail-app-password"
```

**Cara dapat App Password Gmail:**
1. Buka: https://myaccount.google.com/apppasswords
2. Generate password untuk "Mail"
3. Copy & paste ke `.env`

### 2. Jalankan Aplikasi

```bash
npm run start:dev
```

### 3. Test Flow

#### Step 1: Register
```bash
POST http://localhost:3000/auth/register
{
  "email": "test@example.com",
  "password": "password123",
  "full_name": "Test User",
  "role": "USER"
}
```

✅ Response: "Check your email for OTP"
📧 Email terkirim dengan OTP 6-digit

#### Step 2: Verify OTP
```bash
POST http://localhost:3000/auth/verify-otp
{
  "email": "test@example.com",
  "otp": "123456"
}
```

✅ Response: JWT token + user data

#### Step 3: Login
```bash
POST http://localhost:3000/auth/login
{
  "email": "test@example.com",
  "password": "password123"
}
```

✅ Response: JWT token (jika sudah verify)
❌ Error: "Please verify email" (jika belum verify)

## 📋 Endpoints Baru

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/auth/register` | Register + kirim OTP |
| POST | `/auth/verify-otp` | Verify kode OTP |
| POST | `/auth/resend-otp` | Kirim ulang OTP |
| POST | `/auth/login` | Login (harus sudah verify) |

## 📁 Files

- 📖 **OTP_VERIFICATION_GUIDE.md** - Dokumentasi lengkap
- 📊 **SUMMARY_OTP_IMPLEMENTATION.md** - Summary perubahan
- 🧪 **postman_collection_otp.json** - Postman collection untuk testing

## ⚡ Quick Test

Import `postman_collection_otp.json` ke Postman dan test:
1. Register → dapat email
2. Verify OTP → dapat token
3. Login → sukses!

## 🎯 Features

- ✅ OTP 6-digit random
- ✅ Expire 10 menit
- ✅ Email HTML template
- ✅ Resend OTP
- ✅ Login protection (must verify first)
- ✅ Secure dengan bcrypt & JWT

## 💡 Tips

- Gunakan email asli untuk testing
- OTP valid hanya 10 menit
- Bisa resend OTP kapan saja sebelum verify
- Setelah verify, bisa langsung login

## ❓ Troubleshooting

**Email tidak terkirim?**
- Check SMTP credentials di `.env`
- Gunakan App Password, bukan password biasa
- Check console log untuk error

**OTP expired?**
- Klik resend OTP untuk dapat kode baru

---

🎉 **Ready to use!**

