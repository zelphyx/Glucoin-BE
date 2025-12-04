/*
  Warnings:

  - You are about to alter the column `consultation_fee_online` on the `Doctor` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.
  - You are about to alter the column `consultation_fee_offline` on the `Doctor` table. The data in that column could be lost. The data in that column will be cast from `Decimal(65,30)` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Doctor" ALTER COLUMN "consultation_fee_online" DROP NOT NULL,
ALTER COLUMN "consultation_fee_online" SET DATA TYPE INTEGER,
ALTER COLUMN "consultation_fee_offline" DROP NOT NULL,
ALTER COLUMN "consultation_fee_offline" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "password_reset_expires" TIMESTAMP(3),
ADD COLUMN     "password_reset_token" TEXT;
