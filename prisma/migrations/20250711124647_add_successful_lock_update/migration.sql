-- CreateTable
CREATE TABLE "SuccessfulLockUpdate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dailyTaskRunId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "duveId" TEXT NOT NULL,
    "lockId" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "fullAddress" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "lockCode" TEXT NOT NULL,
    "lockCodeStart" TIMESTAMP(3) NOT NULL,
    "lockCodeEnd" TIMESTAMP(3) NOT NULL,
    "processingTime" INTEGER,

    CONSTRAINT "SuccessfulLockUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SuccessfulLockUpdate_dailyTaskRunId_idx" ON "SuccessfulLockUpdate"("dailyTaskRunId");

-- CreateIndex
CREATE INDEX "SuccessfulLockUpdate_lockId_idx" ON "SuccessfulLockUpdate"("lockId");

-- AddForeignKey
ALTER TABLE "SuccessfulLockUpdate" ADD CONSTRAINT "SuccessfulLockUpdate_dailyTaskRunId_fkey" FOREIGN KEY ("dailyTaskRunId") REFERENCES "DailyTaskRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
