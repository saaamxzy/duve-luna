-- CreateTable
CREATE TABLE "LockProfile" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fullPropertyName" TEXT NOT NULL,
    "streetNumber" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "lockId" TEXT,
    "lockCode" TEXT,
    "reservationId" TEXT NOT NULL,

    CONSTRAINT "LockProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LockProfile_reservationId_key" ON "LockProfile"("reservationId");

-- CreateIndex
CREATE INDEX "LockProfile_reservationId_idx" ON "LockProfile"("reservationId");

-- AddForeignKey
ALTER TABLE "LockProfile" ADD CONSTRAINT "LockProfile_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
