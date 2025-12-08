-- CreateEnum
CREATE TYPE "ConsultationType" AS ENUM ('ONLINE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "DoctorSchedule" ADD COLUMN     "is_booked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "booking_date" TIMESTAMP(3) NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "consultation_type" "ConsultationType" NOT NULL,
    "consultation_fee" DECIMAL(65,30) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Booking_user_id_idx" ON "Booking"("user_id");

-- CreateIndex
CREATE INDEX "Booking_doctor_id_idx" ON "Booking"("doctor_id");

-- CreateIndex
CREATE INDEX "Booking_booking_date_idx" ON "Booking"("booking_date");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_schedule_id_booking_date_key" ON "Booking"("schedule_id", "booking_date");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "Doctor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "DoctorSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
