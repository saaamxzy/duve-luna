import cron from "node-cron";
import { db } from "../db";
import { env } from "../../env.cjs";

// --- Types based on Duve API response ---
interface GuestProfile {
  gId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  isPrimary?: boolean;
  guestType: number;
  allowOptInMarketing?: { enabled: boolean };
}

interface UploadedDocument {
  name: string;
  uploadDate: number;
  dtype: string;
  isSecureUpload?: boolean;
  _id: string;
}

interface Property {
  _id: string;
  name: string;
  street: string;
  streetNumber: string;
  city: string;
  status: string;
  tags: string[];
}

interface Precheckin {
  visited?: boolean;
  verifiedEmail?: string;
  verifiedPhone?: string;
  arrivalMethod?: string;
  passportUploaded?: boolean;
  creditCardUploaded?: boolean;
}

interface Reservation {
  _id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phoneNumber?: string;
  status: string;
  bookingStatus: string;
  bookingSourceLabel: string;
  externalId?: string;
  airbnbExternalId?: string;
  code?: string;
  adults: number;
  children: number;
  babies: number;
  rentPrice: number;
  totalRentPrice: number;
  currency?: string;
  startDate: number;
  endDate: number;
  estimatedCheckInTime?: string;
  estimatedCheckOutTime?: string;
  property: Property;
  precheckin?: Precheckin;
  guestProfiles?: GuestProfile[];
  uploadedDocuments?: UploadedDocument[];
}

interface PaginationInfo {
  pageSize: number;
  total: number;
  pages: number;
  hasMore: boolean;
  page: number;
}

interface ApiResponse {
  reservations: Reservation[];
  pagination: PaginationInfo;
}

function isApiResponse(data: unknown): data is ApiResponse {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.reservations) &&
    typeof obj.pagination === "object" &&
    obj.pagination !== null
  );
}

// Function to fetch a single page of reservations
async function fetchReservationsPage(
  page: number,
  today: Date,
): Promise<ApiResponse> {
  const url = new URL("https://frontdesk.duve.com/api/reservations");
  url.searchParams.append("page", page.toString());
  url.searchParams.append("pageSize", "100");
  url.searchParams.append(
    "sort[]",
    JSON.stringify({ id: "checkInDate", desc: true }),
  );
  url.searchParams.append(
    "filter[]",
    JSON.stringify({
      id: "checkInDate",
      value: {
        from: today.toISOString(),
        to: null,
        operator: "eq",
      },
    }),
  );

  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      pragma: "no-cache",
      "sec-ch-ua":
        '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      "x-csrftoken": env.DUVE_CSRF_TOKEN,
      cookie:
        "_gcl_aw=GCL.1748200928.Cj0KCQjw_8rBBhCFARIsAJrc9yDaUYos20Zma24pNwYq73ckItWOEKIu2KqL-xy9f2E_Q7JFnuNz6gUaAoxfEALw_wcB; _gcl_gs=2.1.k1$i1748200925$u214572802; utmSource=google; utmMedium=cpc; utmCampaign=gsn_brand_duve_row; utmContent=Duve_Exact; utmTerm=duve; adClid=Cj0KCQjw_8rBBhCFARIsAJrc9yDaUYos20Zma24pNwYq73ckItWOEKIu2KqL-xy9f2E_Q7JFnuNz6gUaAoxfEALw_wcB; tl=2025-05-25T19:22:07.928Z; tz=America/New_York; lang=en-US; langs=en-US,en,zh-CN; _cq_duid=1.1748200928.5pyJ7Px2FRICsWuO; _cq_suid=1.1748200928.1KGw1KNPDPcTbWeK; _cq_pxg=3|j3161507558303027443633; _clck=haq8rp%7C2%7Cfw7%7C0%7C1971; _clsk=b3d9hl%7C1748200929441%7C1%7C1%7Ce.clarity.ms%2Fcollect; _uetsid=8e05ef20399d11f0bd39d5c9651c976b; _uetvid=8e0602b0399d11f0a9e191ab07b1f4c1; ttcsid_CN4DLD3C77UBB5H8U98G=1748200931572::zJIjtruAiyQ_wEcyU5j5.1.1748200931572; AMP_MKTG_092b5aadda=JTdCJTIycmVmZXJyZXIlMjIlM0ElMjJodHRwcyUzQSUyRiUyRnd3dy5nb29nbGUuY29tJTJGJTIyJTJDJTIycmVmZXJyaW5nX2RvbWFpbiUyMiUzQSUyMnd3dy5nb29nbGUuY29tJTIyJTdE; AMP_092b5aadda=JTdCJTIyZGV2aWNlSWQlMjIlM0ElMjI0N2I2YTlmOS0zNTBlLTQ4N2QtYjI3Mi1jODcyYzBmOTQwNGQlMjIlMkMlMjJzZXNzaW9uSWQlMjIlM0ExNzQ4MjAwOTM3ODc5JTJDJTIyb3B0T3V0JTIyJTNBZmFsc2UlMkMlMjJsYXN0RXZlbnRUaW1lJTIyJTNBMTc0ODIwMTIzNDU3NiUyQyUyMmxhc3RFdmVudElkJTIyJTNBMTQlMkMlMjJwYWdlQ291bnRlciUyMiUzQTIlN0Q=; AMP_MKTG_17fe4404b5=JTdCJTdE; sessionId=s%3AifGXRn18Bj8-PgFoZ9_zvcqjDHQIhX7q.7Kx4cMuOYn0tJGRxp98jbtYKtN7bN71Ou1lpELsReuc; intercom-device-id-y11fhiqs=611b8092-adc2-4da3-9489-0ae3685b3f27; _fbp=fb.1.1748201410225.74380699615892536; _hjSessionUser_766045=eyJpZCI6IjhjMzhmYmRkLTkxZDktNWQzNi1iODAzLTJjNTA1ODRjMjcyMCIsImNyZWF0ZWQiOjE3NDgyMDE0MTAzNjcsImV4aXN0aW5nIjpmYWxzZX0=; _hjSession_766045=eyJpZCI6IjYzZTFhOWNiLTU1NjQtNDhlOC1iZDAzLTcwOTdlYTA0MzU4OSIsImMiOjE3NDgyMDE0MTAzNjcsInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjoxLCJzcCI6MH0=; _hjHasCachedUserAttributes=true; intercom-session-y11fhiqs=UytaRUFwUnpUc0R3SWNtc0c3dnFiS0hSVmhuK0N3djhRZnZ6aXJxaEhCOXBpcENVWlRKeHVHOXRVZFNabmNkbm1wb0x0ZFZtN2ZGMTMrbE5wakxFSHo3UStLRjl1NkY4RjlDc2xmVVFreFk9LS1nYkhsM1FEVGZKSGRCTGE0NmJ2YUdBPT0=--0f54ee94152bf919aee25993e0d7950c4a7b0f57; AMP_17fe4404b5=JTdCJTIyZGV2aWNlSWQlMjIlM0ElMjJlNzk4MTIwNi02ZWI0LTQzNGItYjFhNS1iZWRjMDRmNzc1ZDUlMjIlMkMlMjJ1c2VySWQlMjIlM0ElMjJsdW5haG9zcGl0YWxpdHltZ210JTQwZ21haWwuY29tJTIyJTJDJTIyc2Vzc2lvbklkJTIyJTNBMTc0ODIwMTMwOTIyNSUyQyUyMm9wdE91dCUyMiUzQWZhbHNlJTJDJTIybGFzdEV2ZW50VGltZSUyMiUzQTE3NDgyMDMxNjc3NjclMkMlMjJsYXN0RXZlbnRJZCUyMiUzQTU5JTJDJTIycGFnZUNvdW50ZXIlMjIlM0EzNCU3RA==; csrftoken=W75o4oiHFhCYP%2BgIw3xc9MmLDustj3GK6hiTM%3D",
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: unknown = await response.json();
  if (!isApiResponse(data)) {
    throw new Error("Invalid API response");
  }
  return data;
}

// Function to parse property name components
function parsePropertyName(propertyName: string): {
  streetNumber: string;
  lockName: string;
} {
  // Extract street number (first numeric value)
  const streetNumberMatch = /^\d+/.exec(propertyName);
  const streetNumber = streetNumberMatch ? streetNumberMatch[0] : "";

  // Extract lock name (everything after the street number)
  const lockName = propertyName.replace(/^\d+\s*/, "").trim();

  return { streetNumber, lockName };
}

// Function to process a single reservation
async function processReservation(reservation: Reservation): Promise<void> {
  // Create or update the reservation
  const reservationData = {
    duveId: reservation._id,
    firstName: reservation.firstName,
    lastName: reservation.lastName,
    email: reservation.email ?? null,
    phoneNumber: reservation.phoneNumber ?? null,
    status: reservation.status,
    bookingStatus: reservation.bookingStatus,
    bookingSource: reservation.bookingSourceLabel,
    externalId: reservation.externalId,
    airbnbExternalId: reservation.airbnbExternalId,
    code: reservation.code,
    adults: reservation.adults,
    children: reservation.children,
    babies: reservation.babies,
    rentPrice: reservation.rentPrice,
    totalRentPrice: reservation.totalRentPrice,
    currency: reservation.currency ?? null,
    startDate: new Date(reservation.startDate),
    endDate: new Date(reservation.endDate),
    estimatedCheckInTime: reservation.estimatedCheckInTime ?? null,
    estimatedCheckOutTime: reservation.estimatedCheckOutTime ?? null,

    // Property information
    propertyId: reservation.property._id,
    propertyName: reservation.property.name,
    propertyStreet: reservation.property.street,
    propertyStreetNumber: reservation.property.streetNumber,
    propertyCity: reservation.property.city,
    propertyStatus: reservation.property.status,
    propertyTags: reservation.property.tags,

    // Precheckin information
    precheckinStatus: reservation.precheckin?.visited ? "visited" : null,
    verifiedEmail: reservation.precheckin?.verifiedEmail ?? null,
    verifiedPhone: reservation.precheckin?.verifiedPhone ?? null,
    arrivalMethod: reservation.precheckin?.arrivalMethod ?? null,
    passportUploaded: reservation.precheckin?.passportUploaded ?? false,
    creditCardUploaded: reservation.precheckin?.creditCardUploaded ?? false,
  };

  // Upsert the reservation
  const savedReservation = await db.reservation.upsert({
    where: { duveId: reservation._id },
    create: reservationData,
    update: reservationData,
  });

  // Parse property name and create/update LockProfile
  const { streetNumber, lockName } = parsePropertyName(
    reservation.property.name,
  );

  try {
    // Check if a LockProfile already exists for this property
    const existingLockProfile = await db.lockProfile.findFirst({
      where: {
        streetNumber,
        lockName,
      },
    });

    if (existingLockProfile) {
      // Update the existing LockProfile to link it with this reservation
      await db.lockProfile.update({
        where: { id: existingLockProfile.id },
        data: {
          reservationId: savedReservation.id,
          fullPropertyName: reservation.property.name,
        },
      });
    } else {
      // Create a new LockProfile
      await db.lockProfile.create({
        data: {
          fullPropertyName: reservation.property.name,
          streetNumber,
          lockName,
          reservationId: savedReservation.id,
        },
      });
    }
  } catch (error) {
    console.error("Error processing LockProfile:", error);
    // Continue processing other data even if LockProfile creation fails
  }

  // Process guest profiles
  if (
    Array.isArray(reservation.guestProfiles) &&
    reservation.guestProfiles.length > 0
  ) {
    // Delete existing guest profiles
    await db.guestProfile.deleteMany({
      where: { reservationId: savedReservation.id },
    });

    // Create new guest profiles
    await db.guestProfile.createMany({
      data: reservation.guestProfiles.map((profile: GuestProfile) => ({
        reservationId: savedReservation.id,
        duveGuestId: profile.gId,
        email: profile.email ?? null,
        firstName: profile.firstName ?? null,
        lastName: profile.lastName ?? null,
        phone: profile.phone ?? null,
        isPrimary: profile.isPrimary ?? false,
        guestType: profile.guestType,
        allowOptInMarketing: profile.allowOptInMarketing?.enabled ?? false,
      })),
    });
  }

  // Process documents
  if (
    Array.isArray(reservation.uploadedDocuments) &&
    reservation.uploadedDocuments.length > 0
  ) {
    // Delete existing documents
    await db.document.deleteMany({
      where: { reservationId: savedReservation.id },
    });

    // Create new documents
    await db.document.createMany({
      data: reservation.uploadedDocuments.map((doc: UploadedDocument) => ({
        reservationId: savedReservation.id,
        name: doc.name,
        uploadDate: new Date(doc.uploadDate),
        documentType: doc.dtype,
        isSecureUpload: doc.isSecureUpload ?? false,
        duveDocumentId: doc._id,
      })),
    });
  }
}

// Function that will be executed daily
export async function dailyTask(): Promise<void> {
  try {
    console.log("Running daily task...");

    // Get today's date in ISO format
    const today = new Date();
    today.setHours(16, 0, 0, 0); // Set to 16:00:00 UTC

    let currentPage = 1;
    let totalProcessed = 0;
    let hasMore = true;

    while (hasMore) {
      console.log(`Fetching page ${currentPage}...`);
      const data = await fetchReservationsPage(currentPage, today);

      // Process each reservation in the current page
      for (const reservation of data.reservations) {
        await processReservation(reservation);
        totalProcessed++;
      }

      console.log(
        `Processed ${data.reservations.length} reservations from page ${currentPage}`,
      );

      // Check if there are more pages
      hasMore = data.pagination.hasMore;
      if (hasMore) {
        currentPage++;
      }
    }

    console.log(`Successfully processed all ${totalProcessed} reservations`);
  } catch (error) {
    console.error("Error in daily task:", error);
  }
}

// Schedule the task to run at midnight every day
export function startDailyCron() {
  cron.schedule("0 0 * * *", () => {
    void dailyTask();
  });

  console.log("Daily cron job scheduled");
}
