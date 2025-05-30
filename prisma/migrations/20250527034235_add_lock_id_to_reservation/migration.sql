/*
  Warnings:

  - You are about to drop the column `roomNumber` on the `LockProfile` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[streetNumber,lockName]` on the table `LockProfile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `lockName` to the `LockProfile` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "LockProfile_streetNumber_roomNumber_key";

-- AlterTable
ALTER TABLE "LockProfile" DROP COLUMN "roomNumber",
ADD COLUMN     "lockName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "lockId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LockProfile_streetNumber_lockName_key" ON "LockProfile"("streetNumber", "lockName");
