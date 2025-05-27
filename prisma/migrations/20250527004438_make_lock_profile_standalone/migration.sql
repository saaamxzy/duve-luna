-- DropForeignKey
ALTER TABLE "LockProfile" DROP CONSTRAINT "LockProfile_reservationId_fkey";

-- DropIndex
DROP INDEX "LockProfile_reservationId_key";

-- AlterTable
ALTER TABLE "LockProfile" ALTER COLUMN "reservationId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "LockProfile" ADD CONSTRAINT "LockProfile_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
