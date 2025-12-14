-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "LabStatus" AS ENUM ('NORMAL', 'TINGGI', 'RENDAH', 'KRITIS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "LabResult" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "image_url" TEXT NOT NULL,
    "lab_name" TEXT,
    "test_date" TIMESTAMP(3),
    
    -- Gula Darah
    "gdp" DOUBLE PRECISION,
    "gdp_status" "LabStatus",
    "gd2pp" DOUBLE PRECISION,
    "gd2pp_status" "LabStatus",
    "gds" DOUBLE PRECISION,
    "gds_status" "LabStatus",
    "hba1c" DOUBLE PRECISION,
    "hba1c_status" "LabStatus",
    
    -- Profil Lipid
    "cholesterol_total" DOUBLE PRECISION,
    "cholesterol_status" "LabStatus",
    "ldl" DOUBLE PRECISION,
    "ldl_status" "LabStatus",
    "hdl" DOUBLE PRECISION,
    "hdl_status" "LabStatus",
    "triglycerides" DOUBLE PRECISION,
    "triglycerides_status" "LabStatus",
    
    -- Fungsi Ginjal
    "creatinine" DOUBLE PRECISION,
    "creatinine_status" "LabStatus",
    "urea" DOUBLE PRECISION,
    "urea_status" "LabStatus",
    "uric_acid" DOUBLE PRECISION,
    "uric_acid_status" "LabStatus",
    
    -- Fungsi Hati
    "sgot" DOUBLE PRECISION,
    "sgot_status" "LabStatus",
    "sgpt" DOUBLE PRECISION,
    "sgpt_status" "LabStatus",
    
    -- Darah Lengkap
    "hemoglobin" DOUBLE PRECISION,
    "hemoglobin_status" "LabStatus",
    "hematocrit" DOUBLE PRECISION,
    "hematocrit_status" "LabStatus",
    "leukocytes" DOUBLE PRECISION,
    "leukocytes_status" "LabStatus",
    "platelets" DOUBLE PRECISION,
    "platelets_status" "LabStatus",
    "erythrocytes" DOUBLE PRECISION,
    "erythrocytes_status" "LabStatus",
    
    -- Tekanan Darah
    "blood_pressure_sys" INTEGER,
    "blood_pressure_dia" INTEGER,
    
    -- Metadata
    "raw_extracted_data" JSONB,
    "confidence_score" DOUBLE PRECISION,
    "notes" TEXT,
    
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LabResult_user_id_idx" ON "LabResult"("user_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LabResult_created_at_idx" ON "LabResult"("created_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LabResult_test_date_idx" ON "LabResult"("test_date");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
