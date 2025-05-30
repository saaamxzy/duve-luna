/*
  Warnings:

  - You are about to drop the column `keyboardPwdId` on the `LockProfile` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "LockProfile" DROP COLUMN "keyboardPwdId";

-- CreateTable
CREATE TABLE "KeyboardPassword" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "keyboardPwdId" INTEGER NOT NULL,
    "keyboardPwdName" TEXT NOT NULL,
    "keyboardPwd" TEXT NOT NULL,
    "keyboardPwdType" INTEGER NOT NULL,
    "keyboardPwdVersion" INTEGER NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "sendDate" TIMESTAMP(3) NOT NULL,
    "status" INTEGER NOT NULL,
    "isCustom" BOOLEAN NOT NULL,
    "nickName" TEXT NOT NULL,
    "senderUsername" TEXT NOT NULL,
    "receiverUsername" TEXT,
    "lockProfileId" TEXT NOT NULL,

    CONSTRAINT "KeyboardPassword_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KeyboardPassword_keyboardPwdId_key" ON "KeyboardPassword"("keyboardPwdId");

-- CreateIndex
CREATE INDEX "KeyboardPassword_lockProfileId_idx" ON "KeyboardPassword"("lockProfileId");

-- AddForeignKey
ALTER TABLE "KeyboardPassword" ADD CONSTRAINT "KeyboardPassword_lockProfileId_fkey" FOREIGN KEY ("lockProfileId") REFERENCES "LockProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
