-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED');

-- AlterEnum - Add new values to BookingStatus
-- Need to do this outside of transaction for PostgreSQL
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- AlterTable - Add payment_status column with default PENDING
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "payment_type" TEXT,
    "transaction_id" TEXT,
    "transaction_status" TEXT,
    "transaction_time" TIMESTAMP(3),
    "snap_token" TEXT,
    "snap_redirect_url" TEXT,
    "payment_url" TEXT,
    "va_number" TEXT,
    "bank" TEXT,
    "expiry_time" TIMESTAMP(3),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "raw_response" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_booking_id_key" ON "Payment"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_order_id_key" ON "Payment"("order_id");

-- CreateIndex
CREATE INDEX "Payment_order_id_idx" ON "Payment"("order_id");

-- CreateIndex
CREATE INDEX "Payment_transaction_id_idx" ON "Payment"("transaction_id");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
