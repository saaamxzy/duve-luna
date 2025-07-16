-- AlterTable
ALTER TABLE "DailyTaskRun" ADD COLUMN     "taskType" TEXT NOT NULL DEFAULT 'full';

-- CreateTable
CREATE TABLE "PrepReservation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dailyTaskRunId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "duveId" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "fullAddress" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "lockId" TEXT,
    "lockName" TEXT,
    "streetNumber" TEXT NOT NULL,
    "currentLockCode" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT true,
    "canUpdate" BOOLEAN NOT NULL DEFAULT false,
    "reasonCannotUpdate" TEXT,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PrepReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrepReservation_dailyTaskRunId_idx" ON "PrepReservation"("dailyTaskRunId");

-- CreateIndex
CREATE INDEX "PrepReservation_reservationId_idx" ON "PrepReservation"("reservationId");

-- CreateIndex
CREATE INDEX "PrepReservation_isSelected_idx" ON "PrepReservation"("isSelected");

-- CreateIndex
CREATE INDEX "PrepReservation_processed_idx" ON "PrepReservation"("processed");

-- CreateIndex
CREATE INDEX "DailyTaskRun_taskType_idx" ON "DailyTaskRun"("taskType");

-- AddForeignKey
ALTER TABLE "PrepReservation" ADD CONSTRAINT "PrepReservation_dailyTaskRunId_fkey" FOREIGN KEY ("dailyTaskRunId") REFERENCES "DailyTaskRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
