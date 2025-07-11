-- CreateTable
CREATE TABLE "DailyTaskRun" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "status" TEXT NOT NULL,
    "totalReservations" INTEGER NOT NULL DEFAULT 0,
    "successfulUpdates" INTEGER NOT NULL DEFAULT 0,
    "failedUpdates" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "errorStack" TEXT,

    CONSTRAINT "DailyTaskRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FailedLockUpdate" (
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
    "error" TEXT NOT NULL,
    "errorType" TEXT,
    "errorDetails" JSONB,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" TIMESTAMP(3),
    "retrySuccessful" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FailedLockUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DailyTaskRun_startTime_idx" ON "DailyTaskRun"("startTime");

-- CreateIndex
CREATE INDEX "DailyTaskRun_status_idx" ON "DailyTaskRun"("status");

-- CreateIndex
CREATE INDEX "FailedLockUpdate_dailyTaskRunId_idx" ON "FailedLockUpdate"("dailyTaskRunId");

-- CreateIndex
CREATE INDEX "FailedLockUpdate_lockId_idx" ON "FailedLockUpdate"("lockId");

-- CreateIndex
CREATE INDEX "FailedLockUpdate_retrySuccessful_idx" ON "FailedLockUpdate"("retrySuccessful");

-- AddForeignKey
ALTER TABLE "FailedLockUpdate" ADD CONSTRAINT "FailedLockUpdate_dailyTaskRunId_fkey" FOREIGN KEY ("dailyTaskRunId") REFERENCES "DailyTaskRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
