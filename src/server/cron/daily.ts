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

// Add at the top of the file, after imports
const TEST_MODE = false; // Set to false in production
const TEST_STREET_NUMBER = "800";
const TEST_FIRST_NAME = "Sam";
const TEST_LAST_NAME = "X";

// Function to check if reservation is test data
function isTestData(reservation: Reservation): boolean {
  return (
    reservation.property.streetNumber === TEST_STREET_NUMBER &&
    reservation.firstName === TEST_FIRST_NAME &&
    reservation.lastName === TEST_LAST_NAME
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
  // Improved regex: capture street number and next token (word/code) after street number
  const match = propertyName.match(/^(\d+)\s*(?:-\s*)?([^\s-]+)/);
  const streetNumber = (match && match[1]) ? match[1] : "";
  const lockName = (match && match[2]) ? match[2] : "";
  return { streetNumber, lockName };
}

// Function to generate a random 4-digit code
function generateLockCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Function to update Duve reservation with the new lock code
async function updateDuveReservationCode(duveId: string, code: string): Promise<boolean> {
  try {
    const response = await fetch(`https://frontdesk.duve.com/api/reservations/${duveId}`, {
      method: 'PUT',
      headers: {
        'accept': 'application/json',
        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'cache-control': 'no-cache',
        'content-type': 'application/json',
        'origin': 'https://frontdesk.duve.com',
        'pragma': 'no-cache',
        'priority': 'u=1, i',
        'referer': `https://frontdesk.duve.com/reservations/${duveId}`,
        'sec-ch-ua': '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'x-csrftoken': env.DUVE_CSRF_TOKEN,
        'cookie': env.DUVE_COOKIE
      },
      body: JSON.stringify({
        mode: true,
        aptC: `${code}#`
      })
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`[Duve] Failed to update reservation code for ${duveId}:`, {
        status: response.status,
        statusText: response.statusText,
        response: responseText
      });
      return false;
    }

    if (TEST_MODE) {
      console.log(`[Duve] Successfully updated reservation code for ${duveId} to ${code}#`);
    }

    return true;
  } catch (error) {
    console.error(`[Duve] Error updating reservation code for ${duveId}:`, error);
    return false;
  }
}

// Function to update lock code via API
async function updateLockCode(lockId: string, newCode: string, startDate: Date, endDate: Date, duveId: string): Promise<boolean> {
  try {
    // Find the LockProfile and its keyboard passwords
    const lockProfile = await db.lockProfile.findFirst({
      where: { lockId },
      include: {
        keyboardPasswords: {
          where: {
            keyboardPwdName: {
              in: ["Guest Code 1", "Guest Code 2"]
            },
            status: 1, // Active passwords only
            startDate: {
              not: null // Must have a start date
            }
          },
          orderBy: {
            startDate: 'asc' // Get the oldest one
          },
          take: 1
        }
      }
    });

    if (!lockProfile) {
      console.error(`[LockProfile] No LockProfile found for lockId ${lockId}`);
      return false;
    }

    const keyboardPassword = lockProfile.keyboardPasswords[0];
    if (!keyboardPassword) {
      console.error(`[LockProfile] No active Guest Code found for lockId ${lockId}`);
      return false;
    }

    // Set specific times for check-in (3 PM) and check-out (11 AM) in UTC
    // Adjusting for the timezone difference (UTC-4 for EDT)
    const checkInTime = new Date(startDate);
    checkInTime.setUTCHours(19, 0, 0, 0); // 3 PM EDT = 19:00 UTC

    const checkOutTime = new Date(endDate);
    checkOutTime.setUTCHours(15, 0, 0, 0); // 11 AM EDT = 15:00 UTC

    if (TEST_MODE) {
      console.log(`[LockProfile] Test Mode - Details for lockId ${lockId}:`);
      console.log(`- Keyboard Password ID: ${keyboardPassword.keyboardPwdId}`);
      console.log(`- Current Password: ${keyboardPassword.keyboardPwd}`);
      console.log(`- Password Name: ${keyboardPassword.keyboardPwdName}`);
      console.log(`- Start Date: ${new Date(keyboardPassword.startDate!).toISOString()}`);
      console.log(`- End Date: ${new Date(keyboardPassword.endDate!).toISOString()}`);
      console.log(`- New Code: ${newCode}`);
      console.log(`- New Start Date: ${checkInTime.toISOString()}`);
      console.log(`- New End Date: ${checkOutTime.toISOString()}`);
    }

    const response = await fetch("https://pro-server.sifely.com/v3/keyboardPwd/change", {
      method: "POST",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        "Authorization": "Bearer eyJhbGciOiJIUzUxMiJ9.eyJjbGllbnRfaWQiOm51bGwsImxvZ2luX3VzZXJfa2V5IjoiMWYxYTU4MGMtMjZkNi00ZTJhLThhMzQtMmFmZGYzMTcxZjQ1In0.iR80jf1HnZ77OyT5BciK0c3LvzEqBVAAug6cuM8OzzUNOnIikMIueJhWsd7QUIqIxiqENdbHFzozvFSjxg0tKw",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Content-Type": "application/x-www-form-urlencoded",
        "Origin": "https://manager.sifely.com",
        "Pragma": "no-cache",
        "Referer": "https://manager.sifely.com/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
        "sec-ch-ua": '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"macOS"'
      },
      body: new URLSearchParams({
        changeType: "2",
        keyboardPwdName: keyboardPassword.keyboardPwdName, // Use the same name as the password we're updating
        newKeyboardPwd: newCode,
        lockId: lockId,
        keyboardPwdId: keyboardPassword.keyboardPwdId.toString(),
        date: Date.now().toString(),
        startDate: checkInTime.getTime().toString(),
        endDate: checkOutTime.getTime().toString()
      }).toString()
    });

    const data = await response.json();
    
    if (TEST_MODE) {
      console.log(`[LockProfile] Test Mode - API Response for lockId ${lockId}:`);
      console.log(JSON.stringify(data, null, 2));
    }
    
    if (data.code !== 200) {
      console.error(`[LockProfile] API Error for lockId ${lockId}:`, {
        status: response.status,
        statusText: response.statusText,
        response: data
      });
      return false;
    }

    // Update the KeyboardPassword record in the database
    await db.keyboardPassword.update({
      where: { keyboardPwdId: keyboardPassword.keyboardPwdId },
      data: {
        keyboardPwd: newCode,
        startDate: checkInTime,
        endDate: checkOutTime
      }
    });

    // Update the Duve reservation with the new code
    const duveUpdateSuccess = await updateDuveReservationCode(duveId, newCode);
    if (!duveUpdateSuccess) {
      console.error(`[LockProfile] Failed to update Duve reservation code for ${duveId}`);
      // We still return true since the lock code was updated successfully
    }

    return true;
  } catch (error) {
    console.error(`[LockProfile] Error updating lock code for lockId ${lockId}:`, error);
    return false;
  }
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
    create: {
      ...reservationData,
      bookingStatus: reservation.bookingStatus || "unknown",
      bookingSource: reservation.bookingSourceLabel || "unknown",
    },
    update: {
      ...reservationData,
      bookingStatus: reservation.bookingStatus || "unknown",
      bookingSource: reservation.bookingSourceLabel || "unknown",
    },
  });

  // Parse property name and create/update LockProfile
  const { streetNumber, lockName } = parsePropertyName(
    reservation.property.name,
  );

  try {
    // Find the corresponding LockProfile
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

      if (existingLockProfile.lockId) {
        // Check if we should update this lock code
        const shouldUpdate = !TEST_MODE || isTestData(reservation);
        
        if (shouldUpdate) {
          // Generate new lock code and update via API
          const newLockCode = generateLockCode();
          const updateSuccess = await updateLockCode(
            existingLockProfile.lockId, 
            newLockCode,
            new Date(reservation.startDate),
            new Date(reservation.endDate),
            reservation._id
          );

          if (updateSuccess) {
            // Update both LockProfile and Reservation with the new lock code
            await db.lockProfile.update({
              where: { id: existingLockProfile.id },
              data: {
                lockCode: `#${newLockCode}`,
              },
            });

            await db.reservation.update({
              where: { id: savedReservation.id },
              data: {
                lockId: existingLockProfile.lockId,
              },
            });

            console.log(
              `[LockProfile] Successfully updated lock code for reservation ${savedReservation.id} (lockId: ${existingLockProfile.lockId}, new code: #${newLockCode})`
            );
          } else {
            console.error(
              `[LockProfile] Failed to update lock code for reservation ${savedReservation.id} (lockId: ${existingLockProfile.lockId})`
            );
          }
        } else {
          console.log(
            `[LockProfile] Skipping lock code update for non-test data: ${reservation.property.name} (${reservation.firstName} ${reservation.lastName})`
          );
        }
      } else {
        // LockProfile found but lockId is missing
        await db.reservation.update({
          where: { id: savedReservation.id },
          data: {
            lockId: null,
          },
        });
        console.warn(
          `[LockProfile] WARNING: LockProfile found for property '${reservation.property.name}' (streetNumber: '${streetNumber}', lockName: '${lockName}') but lockId is missing. Reservation ${savedReservation.id} set to lockId=null.`
        );
      }
    } else {
      // No LockProfile found for this property
      await db.reservation.update({
        where: { id: savedReservation.id },
        data: {
          lockId: null,
        },
      });
      console.warn(
        `[LockProfile] WARNING: No LockProfile found for property '${reservation.property.name}' (streetNumber: '${streetNumber}', lockName: '${lockName}'). Reservation ${savedReservation.id} set to lockId=null.`
      );
      // Optionally, create a new LockProfile here if desired
    }
  } catch (error) {
    console.error(`[LockProfile] ERROR processing LockProfile for reservation ${savedReservation.id} (property: '${reservation.property.name}', streetNumber: '${streetNumber}', lockName: '${lockName}'):`, error);
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
