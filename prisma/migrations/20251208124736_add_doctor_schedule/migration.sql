/*
  Warnings:

  - You are about to drop the column `bio` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `consultation_fee_offline` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `consultation_fee_online` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `license_number` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `qualifications` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `total_patients` on the `Doctor` table. All the data in the column will be lost.
  - You are about to drop the column `years_of_experience` on the `Doctor` table. All the data in the column will be lost.
  - Added the required column `alamat_praktek` to the `Doctor` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price_range` to the `Doctor` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- DropIndex
DROP INDEX "Doctor_license_number_key";

-- AlterTable
ALTER TABLE "Doctor" DROP COLUMN "bio",
DROP COLUMN "consultation_fee_offline",
DROP COLUMN "consultation_fee_online",
DROP COLUMN "license_number",
DROP COLUMN "qualifications",
DROP COLUMN "rating",
DROP COLUMN "total_patients",
DROP COLUMN "years_of_experience",
ADD COLUMN     "alamat_praktek" TEXT NOT NULL,
ADD COLUMN     "price_range" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "DoctorSchedule" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "day_of_week" "DayOfWeek" NOT NULL,
    "time_slot" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DoctorSchedule_doctor_id_day_of_week_idx" ON "DoctorSchedule"("doctor_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorSchedule_doctor_id_day_of_week_time_slot_key" ON "DoctorSchedule"("doctor_id", "day_of_week", "time_slot");

-- AddForeignKey
ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
