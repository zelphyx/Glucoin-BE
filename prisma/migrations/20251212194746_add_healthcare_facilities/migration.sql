-- CreateEnum
CREATE TYPE "FacilityType" AS ENUM ('HOSPITAL', 'PHARMACY', 'CLINIC', 'PUSKESMAS', 'LAB');

-- CreateTable
CREATE TABLE "HealthcareFacility" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "FacilityType" NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "phone" TEXT,
    "latitude" DECIMAL(65,30) NOT NULL,
    "longitude" DECIMAL(65,30) NOT NULL,
    "image_url" TEXT,
    "rating" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "is_open_24h" BOOLEAN NOT NULL DEFAULT false,
    "opening_time" TEXT,
    "closing_time" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthcareFacility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthcareFacility_type_idx" ON "HealthcareFacility"("type");

-- CreateIndex
CREATE INDEX "HealthcareFacility_city_idx" ON "HealthcareFacility"("city");

-- CreateIndex
CREATE INDEX "HealthcareFacility_is_active_idx" ON "HealthcareFacility"("is_active");
