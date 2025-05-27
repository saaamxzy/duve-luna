-- CreateTable
CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "duveId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phoneNumber" TEXT,
    "status" TEXT NOT NULL,
    "bookingStatus" TEXT NOT NULL,
    "bookingSource" TEXT NOT NULL,
    "externalId" TEXT,
    "airbnbExternalId" TEXT,
    "code" TEXT,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL,
    "babies" INTEGER NOT NULL,
    "rentPrice" DOUBLE PRECISION NOT NULL,
    "totalRentPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "estimatedCheckInTime" TEXT,
    "estimatedCheckOutTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "propertyId" TEXT NOT NULL,
    "propertyName" TEXT NOT NULL,
    "propertyStreet" TEXT NOT NULL,
    "propertyStreetNumber" TEXT NOT NULL,
    "propertyCity" TEXT NOT NULL,
    "propertyStatus" TEXT NOT NULL,
    "propertyTags" TEXT[],
    "precheckinStatus" TEXT,
    "verifiedEmail" TEXT,
    "verifiedPhone" TEXT,
    "arrivalMethod" TEXT,
    "passportUploaded" BOOLEAN NOT NULL DEFAULT false,
    "creditCardUploaded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestProfile" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "duveGuestId" TEXT NOT NULL,
    "email" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "guestType" INTEGER NOT NULL,
    "allowOptInMarketing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uploadDate" TIMESTAMP(3) NOT NULL,
    "documentType" TEXT NOT NULL,
    "isSecureUpload" BOOLEAN NOT NULL DEFAULT false,
    "duveDocumentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Post_name_idx" ON "Post"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_duveId_key" ON "Reservation"("duveId");

-- AddForeignKey
ALTER TABLE "GuestProfile" ADD CONSTRAINT "GuestProfile_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
