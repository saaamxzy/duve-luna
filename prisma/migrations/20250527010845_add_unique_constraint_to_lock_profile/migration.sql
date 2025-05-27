/*
  Warnings:

  - A unique constraint covering the columns `[streetNumber,roomNumber]` on the table `LockProfile` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "LockProfile_streetNumber_roomNumber_key" ON "LockProfile"("streetNumber", "roomNumber");
