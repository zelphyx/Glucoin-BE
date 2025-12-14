-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "DailyTaskType" AS ENUM (
        'GLUCOSE_CHECK',
        'MEDICATION',
        'INSULIN',
        'EXERCISE',
        'WATER_INTAKE',
        'MEAL',
        'FOOT_CHECK',
        'BLOOD_PRESSURE',
        'WEIGHT_CHECK',
        'CUSTOM'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: DailyTaskTemplate
CREATE TABLE IF NOT EXISTS "DailyTaskTemplate" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "task_type" "DailyTaskType" NOT NULL,
    "time" TEXT NOT NULL,
    "days" TEXT[],
    "medication_name" TEXT,
    "dosage" TEXT,
    "target_minutes" INTEGER,
    "target_glasses" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "send_reminder" BOOLEAN NOT NULL DEFAULT true,
    "reminder_minutes_before" INTEGER NOT NULL DEFAULT 0,
    "icon" TEXT,
    "color" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DailyTask
CREATE TABLE IF NOT EXISTS "DailyTask" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "template_id" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "task_type" "DailyTaskType" NOT NULL,
    "task_date" TIMESTAMP(3) NOT NULL,
    "scheduled_time" TEXT,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "glucose_level" INTEGER,
    "medication_name" TEXT,
    "dosage" TEXT,
    "exercise_minutes" INTEGER,
    "water_glasses" INTEGER,
    "notes" TEXT,
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "reminder_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DailyTaskTemplate_user_id_idx" ON "DailyTaskTemplate"("user_id");
CREATE INDEX IF NOT EXISTS "DailyTaskTemplate_task_type_idx" ON "DailyTaskTemplate"("task_type");

CREATE UNIQUE INDEX IF NOT EXISTS "DailyTask_user_id_template_id_task_date_key" ON "DailyTask"("user_id", "template_id", "task_date");
CREATE INDEX IF NOT EXISTS "DailyTask_user_id_task_date_idx" ON "DailyTask"("user_id", "task_date");
CREATE INDEX IF NOT EXISTS "DailyTask_task_date_idx" ON "DailyTask"("task_date");
CREATE INDEX IF NOT EXISTS "DailyTask_is_completed_idx" ON "DailyTask"("is_completed");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "DailyTaskTemplate" ADD CONSTRAINT "DailyTaskTemplate_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_user_id_fkey" 
        FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "DailyTask" ADD CONSTRAINT "DailyTask_template_id_fkey" 
        FOREIGN KEY ("template_id") REFERENCES "DailyTaskTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
