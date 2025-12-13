-- CreateEnum
CREATE TYPE "DiabetesType" AS ENUM ('TYPE_1', 'TYPE_2', 'GESTATIONAL', 'PRE_DIABETES');

-- CreateEnum
CREATE TYPE "GlucoseCategory" AS ENUM ('FASTING', 'BEFORE_MEAL', 'AFTER_MEAL', 'RANDOM', 'BEDTIME');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('GLUCOSE_CHECK', 'MEDICATION', 'INSULIN', 'EXERCISE', 'APPOINTMENT', 'CUSTOM');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alergi" TEXT,
ADD COLUMN     "diabetes_type" "DiabetesType",
ADD COLUMN     "diagnosis_date" TIMESTAMP(3),
ADD COLUMN     "golongan_darah" TEXT,
ADD COLUMN     "hba1c_target" DECIMAL(65,30),
ADD COLUMN     "is_on_insulin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_reminder_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "last_hba1c" DECIMAL(65,30),
ADD COLUMN     "last_hba1c_date" TIMESTAMP(3),
ADD COLUMN     "target_glucose_max" INTEGER,
ADD COLUMN     "target_glucose_min" INTEGER,
ADD COLUMN     "tekanan_darah" TEXT;

-- CreateTable
CREATE TABLE "GlucoseLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "glucose_level" INTEGER NOT NULL,
    "category" "GlucoseCategory" NOT NULL,
    "measured_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "is_normal" BOOLEAN,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlucoseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "ReminderType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "time" TEXT NOT NULL,
    "days" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sent_at" TIMESTAMP(3),
    "next_send_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicationLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "medication_name" TEXT NOT NULL,
    "dosage" TEXT NOT NULL,
    "taken_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GlucoseLog_user_id_idx" ON "GlucoseLog"("user_id");

-- CreateIndex
CREATE INDEX "GlucoseLog_measured_at_idx" ON "GlucoseLog"("measured_at");

-- CreateIndex
CREATE INDEX "GlucoseLog_user_id_measured_at_idx" ON "GlucoseLog"("user_id", "measured_at");

-- CreateIndex
CREATE INDEX "Reminder_user_id_idx" ON "Reminder"("user_id");

-- CreateIndex
CREATE INDEX "Reminder_is_active_next_send_at_idx" ON "Reminder"("is_active", "next_send_at");

-- CreateIndex
CREATE INDEX "MedicationLog_user_id_idx" ON "MedicationLog"("user_id");

-- CreateIndex
CREATE INDEX "MedicationLog_taken_at_idx" ON "MedicationLog"("taken_at");

-- AddForeignKey
ALTER TABLE "GlucoseLog" ADD CONSTRAINT "GlucoseLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicationLog" ADD CONSTRAINT "MedicationLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
