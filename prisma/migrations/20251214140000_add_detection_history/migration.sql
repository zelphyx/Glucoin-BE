-- CreateEnum
CREATE TYPE "DetectionType" AS ENUM ('IMAGE', 'QUESTIONNAIRE', 'COMBINED', 'FULL_SCREENING');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('TIDAK', 'RENDAH', 'SEDANG', 'TINGGI');

-- CreateTable
CREATE TABLE "DetectionHistory" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "detection_type" "DetectionType" NOT NULL,
    "tongue_image_url" TEXT,
    "nail_image_url" TEXT,
    "tongue_valid" BOOLEAN,
    "tongue_probability" DOUBLE PRECISION,
    "nail_valid" BOOLEAN,
    "nail_probability" DOUBLE PRECISION,
    "image_score" DOUBLE PRECISION,
    "questionnaire_data" JSONB,
    "questionnaire_score" DOUBLE PRECISION,
    "final_score" DOUBLE PRECISION NOT NULL,
    "risk_level" "RiskLevel" NOT NULL,
    "prediction" TEXT NOT NULL,
    "interpretation" TEXT NOT NULL,
    "recommendations" TEXT[],
    "raw_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DetectionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DetectionHistory_user_id_idx" ON "DetectionHistory"("user_id");

-- CreateIndex
CREATE INDEX "DetectionHistory_created_at_idx" ON "DetectionHistory"("created_at");

-- CreateIndex
CREATE INDEX "DetectionHistory_risk_level_idx" ON "DetectionHistory"("risk_level");

-- AddForeignKey
ALTER TABLE "DetectionHistory" ADD CONSTRAINT "DetectionHistory_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
