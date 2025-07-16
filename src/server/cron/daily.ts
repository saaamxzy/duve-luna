import cron from "node-cron";
import { db } from "../db";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import {
  getConfigWithFallback,
  prewarmConfigCache,
  VERCEL_OPTIMIZATIONS,
} from "../config";
import { refreshLockProfileData } from "../lockProfileManager";

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

// Type for lock profile with keyboard passwords
interface LockProfileWithPasswords {
  id: string;
  lockId: string | null;
  lockCode: string | null;
  fullPropertyName: string;
  streetNumber: string;
  lockName: string;
  reservationId: string | null;
  keyboardPasswords: Array<{
    keyboardPwdId: number;
    keyboardPwdName: string;
    keyboardPwd: string;
    keyboardPwdType: number;
    keyboardPwdVersion: number;
    startDate: Date | null;
    endDate: Date | null;
    status: number;
    isCustom: boolean;
  }>;
}

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

  // Get configuration values from database with fallback to environment variables
  const duveCSRFToken = await getConfigWithFallback("DUVE_CSRF_TOKEN");
  const duveCookie = await getConfigWithFallback("DUVE_COOKIE");

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
      "x-csrftoken": duveCSRFToken ?? "",
      cookie: duveCookie ?? "",
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
  const typedData: ApiResponse = data;
  return typedData;
}

// Function to parse property name components
function parsePropertyName(propertyName: string): {
  streetNumber: string;
  lockName: string;
} {
  // Improved regex: capture street number and next token (word/code) after street number
  const regex = /^(\d+)\s*(?:-\s*)?([^\s-]+)/;
  const match = regex.exec(propertyName);
  const streetNumber = match?.[1] ?? "";
  const lockName = match?.[2] ?? "";
  return { streetNumber, lockName };
}

// Function to generate a random 4-digit code
function generateLockCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Function to update Duve reservation with the new lock code
async function updateDuveReservationCode(
  duveId: string,
  code: string,
): Promise<boolean> {
  try {
    // Get configuration values from database with fallback to environment variables
    const duveCSRFToken = await getConfigWithFallback("DUVE_CSRF_TOKEN");
    const duveCookie = await getConfigWithFallback("DUVE_COOKIE");

    const response = await fetch(
      `https://frontdesk.duve.com/api/reservations/${duveId}`,
      {
        method: "PUT",
        headers: {
          accept: "application/json",
          "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
          "cache-control": "no-cache",
          "content-type": "application/json",
          origin: "https://frontdesk.duve.com",
          pragma: "no-cache",
          priority: "u=1, i",
          referer: `https://frontdesk.duve.com/reservations/${duveId}`,
          "sec-ch-ua":
            '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "sec-fetch-dest": "empty",
          "sec-fetch-mode": "cors",
          "sec-fetch-site": "same-origin",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
          "x-csrftoken": duveCSRFToken ?? "",
          cookie: duveCookie ?? "",
        },
        body: JSON.stringify({
          mode: true,
          aptC: `${code}#`,
        }),
      },
    );

    if (!response.ok) {
      const responseText = await response.text();
      console.error(`[Duve] Failed to update reservation code for ${duveId}:`, {
        status: response.status,
        statusText: response.statusText,
        response: responseText,
      });
      return false;
    }

    if (TEST_MODE) {
      console.log(
        `[Duve] Successfully updated reservation code for ${duveId} to ${code}#`,
      );
    }

    return true;
  } catch (error) {
    console.error(
      `[Duve] Error updating reservation code for ${duveId}:`,
      error,
    );
    return false;
  }
}

// Result type for lock code updates
export interface LockUpdateResult {
  success: boolean;
  errorDetails?: {
    type: "sifely_api" | "duve_api" | "network" | "database" | "unknown";
    message: string;
    apiResponse?: {
      code?: number;
      msg?: string;
      errcode?: number;
      errmsg?: string;
      description?: string;
    };
    httpStatus?: number;
  };
}

// Function to update lock code via API
export async function updateLockCode(
  lockId: string,
  newCode: string,
  startDate: Date,
  endDate: Date,
  duveId: string,
): Promise<LockUpdateResult> {
  try {
    // Find the LockProfile and its keyboard passwords
    const lockProfile = await db.lockProfile.findFirst({
      where: { lockId },
      include: {
        keyboardPasswords: {
          where: {
            keyboardPwdName: {
              in: [
                "Guest Code 1",
                "Guest Code 2",
                "Guest code 1",
                "Guest code 2",
                "guest code 1",
                "guest code 2",
              ],
            },
            status: 1, // Active passwords only
            startDate: {
              not: null, // Must have a start date
            },
          },
          orderBy: {
            startDate: "asc", // Get the oldest one
          },
          take: 1,
        },
      },
    });

    if (!lockProfile) {
      console.error(`[LockProfile] No LockProfile found for lockId ${lockId}`);
      return {
        success: false,
        errorDetails: {
          type: "database",
          message: `No LockProfile found for lockId ${lockId}`,
        },
      };
    }

    const keyboardPassword = lockProfile.keyboardPasswords[0];
    if (!keyboardPassword) {
      console.error(
        `[LockProfile] No active Guest Code found for lockId ${lockId}`,
      );
      return {
        success: false,
        errorDetails: {
          type: "database",
          message: `No active Guest Code found for lockId ${lockId}`,
        },
      };
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
      console.log(
        `- Start Date: ${new Date(keyboardPassword.startDate!).toISOString()}`,
      );
      console.log(
        `- End Date: ${new Date(keyboardPassword.endDate!).toISOString()}`,
      );
      console.log(`- New Code: ${newCode}`);
      console.log(`- New Start Date: ${checkInTime.toISOString()}`);
      console.log(`- New End Date: ${checkOutTime.toISOString()}`);
    }

    // Get configuration values from database with fallback to environment variables
    const sifelyAuthToken = await getConfigWithFallback("SIFELY_AUTH_TOKEN");

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      VERCEL_OPTIMIZATIONS.API_TIMEOUT,
    );

    const response = await fetch(
      "https://pro-server.sifely.com/v3/keyboardPwd/change",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
          Authorization: sifelyAuthToken ?? "",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: "https://manager.sifely.com",
          Pragma: "no-cache",
          Referer: "https://manager.sifely.com/",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-site",
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
          "sec-ch-ua":
            '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
        },
        body: new URLSearchParams({
          changeType: "2",
          keyboardPwdName: keyboardPassword.keyboardPwdName, // Use the same name as the password we're updating
          newKeyboardPwd: newCode,
          lockId: lockId,
          keyboardPwdId: keyboardPassword.keyboardPwdId.toString(),
          date: Date.now().toString(),
          startDate: checkInTime.getTime().toString(),
          endDate: checkOutTime.getTime().toString(),
        }).toString(),
      },
    );

    clearTimeout(timeout);

    const data: unknown = await response.json();
    // Add explicit type for API response with nested error handling
    const apiResponse = data as {
      code: number;
      msg?: string;
      data?: {
        errcode?: number;
        errmsg?: string;
        description?: string;
      };
      [key: string]: unknown;
    };

    if (TEST_MODE) {
      console.log(
        `[LockProfile] Test Mode - API Response for lockId ${lockId}:`,
      );
      console.log(JSON.stringify(apiResponse, null, 2));
    }

    if (apiResponse.code !== 200) {
      console.error(
        `[LockProfile] API Error for lockId ${lockId} - Request failed:`,
        {
          status: response.status,
          statusText: response.statusText,
          response: apiResponse,
        },
      );
      return {
        success: false,
        errorDetails: {
          type: "sifely_api",
          message: `API request failed with status ${response.status}`,
          apiResponse: {
            code: apiResponse.code,
            msg: apiResponse.msg,
          },
          httpStatus: response.status,
        },
      };
    }

    // Check for nested error codes even when main response is successful
    if (apiResponse.data?.errcode && apiResponse.data.errcode !== 0) {
      console.error(
        `[LockProfile] API Error for lockId ${lockId} - Operation failed:`,
        {
          errcode: apiResponse.data.errcode,
          errmsg: apiResponse.data.errmsg,
          description: apiResponse.data.description,
        },
      );
      console.error(
        `[LockProfile] Lock update failed: ${apiResponse.data.errmsg}`,
      );
      return {
        success: false,
        errorDetails: {
          type: "sifely_api",
          message: apiResponse.data.errmsg ?? "Lock operation failed",
          apiResponse: {
            code: apiResponse.code,
            msg: apiResponse.msg,
            errcode: apiResponse.data.errcode,
            errmsg: apiResponse.data.errmsg,
            description: apiResponse.data.description,
          },
          httpStatus: response.status,
        },
      };
    }

    // Update the KeyboardPassword record in the database
    await db.keyboardPassword.update({
      where: { keyboardPwdId: keyboardPassword.keyboardPwdId },
      data: {
        keyboardPwd: newCode,
        startDate: checkInTime,
        endDate: checkOutTime,
      },
    });

    // Update the Duve reservation with the new code
    const duveUpdateSuccess = await updateDuveReservationCode(duveId, newCode);
    if (!duveUpdateSuccess) {
      console.error(
        `[LockProfile] Failed to update Duve reservation code for ${duveId}`,
      );
      // We still return true since the lock code was updated successfully
    }

    return { success: true };
  } catch (error) {
    console.error(
      `[LockProfile] Error updating lock code for lockId ${lockId}:`,
      error,
    );

    // Return more detailed error information
    if (error instanceof Error) {
      return {
        success: false,
        errorDetails: {
          type: "unknown",
          message: error.message,
        },
      };
    }
    return {
      success: false,
      errorDetails: {
        type: "unknown",
        message: "Unknown error occurred",
      },
    };
  }
}

// Function to process a single reservation (unused but kept for reference)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function processReservation(
  reservation: Reservation,
  dailyTaskRunId: string,
): Promise<{ success: boolean; lockUpdateFailed?: boolean }> {
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
      bookingStatus: reservation.bookingStatus ?? "unknown",
      bookingSource: reservation.bookingSourceLabel ?? "unknown",
    },
    update: {
      ...reservationData,
      bookingStatus: reservation.bookingStatus ?? "unknown",
      bookingSource: reservation.bookingSourceLabel ?? "unknown",
    },
  });

  // Parse property name and create/update LockProfile
  const { streetNumber, lockName } = parsePropertyName(
    reservation.property.name,
  );

  // Create full address for logging
  const fullAddress = `${reservation.property.streetNumber} ${reservation.property.street}, ${reservation.property.city}`;
  const guestName = `${reservation.firstName} ${reservation.lastName}`;

  let lockUpdateFailed = false;

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
          // Check if this lock has already been successfully updated today
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Start of today
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1); // Start of tomorrow

          const existingUpdate = await db.successfulLockUpdate.findFirst({
            where: {
              lockId: existingLockProfile.lockId,
              createdAt: {
                gte: today,
                lt: tomorrow,
              },
            },
          });

          if (existingUpdate) {
            console.log(
              `[LockProfile] Lock ${existingLockProfile.lockId} already updated today. Skipping update for reservation ${savedReservation.id} (${fullAddress} - ${guestName})`,
            );

            // Still link the reservation to the existing lock
            await db.reservation.update({
              where: { id: savedReservation.id },
              data: {
                lockId: existingLockProfile.lockId,
              },
            });

            return { success: true, lockUpdateFailed: false };
          }

          // Generate new lock code and update via API
          const newLockCode = generateLockCode();
          const updateStartTime = Date.now();
          const updateResult = await updateLockCode(
            existingLockProfile.lockId,
            newLockCode,
            new Date(reservation.startDate),
            new Date(reservation.endDate),
            reservation._id,
          );
          const updateEndTime = Date.now();
          const processingTime = updateEndTime - updateStartTime;

          if (updateResult.success) {
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
              `[LockProfile] Successfully updated lock code for reservation ${savedReservation.id} (${fullAddress} - ${guestName}) (lockId: ${existingLockProfile.lockId}, new code: #${newLockCode})`,
            );

            // Log successful lock update to database
            await logSuccessfulLockUpdate(
              {
                reservationId: savedReservation.id,
                duveId: reservation._id,
                lockId: existingLockProfile.lockId,
                propertyName: reservation.property.name,
                fullAddress,
                guestName,
                startDate: new Date(reservation.startDate).toISOString(),
                endDate: new Date(reservation.endDate).toISOString(),
                lockCode: `#${newLockCode}`,
                lockCodeStart: new Date(reservation.startDate).toISOString(),
                lockCodeEnd: new Date(reservation.endDate).toISOString(),
                processingTime,
              },
              dailyTaskRunId,
            );
          } else {
            console.error(
              `[LockProfile] Failed to update lock code for reservation ${savedReservation.id} (${fullAddress} - ${guestName}) (lockId: ${existingLockProfile.lockId})`,
            );

            lockUpdateFailed = true;

            // Log failed lock update to file with detailed error information
            await logFailedLockUpdate(
              {
                reservationId: savedReservation.id,
                duveId: reservation._id,
                lockId: existingLockProfile.lockId,
                propertyName: reservation.property.name,
                fullAddress,
                guestName,
                startDate: new Date(reservation.startDate).toISOString(),
                endDate: new Date(reservation.endDate).toISOString(),
                error:
                  updateResult.errorDetails?.message ??
                  "Lock code update failed",
                errorDetails: updateResult.errorDetails,
              },
              dailyTaskRunId,
            );
          }
        } else {
          console.log(
            `[LockProfile] Skipping lock code update for non-test data: ${fullAddress} (${guestName})`,
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
          `[LockProfile] WARNING: LockProfile found for property '${fullAddress}' (streetNumber: '${streetNumber}', lockName: '${lockName}') but lockId is missing. Reservation ${savedReservation.id} set to lockId=null.`,
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
        `[LockProfile] WARNING: No LockProfile found for property '${fullAddress}' (streetNumber: '${streetNumber}', lockName: '${lockName}'). Reservation ${savedReservation.id} set to lockId=null.`,
      );
      // Optionally, create a new LockProfile here if desired
    }
  } catch (error) {
    console.error(
      `[LockProfile] ERROR processing LockProfile for reservation ${savedReservation.id} (${fullAddress} - ${guestName}):`,
      error,
    );

    lockUpdateFailed = true;

    // Log failed lock update to file if we have a lockId
    if (error instanceof Error) {
      await logFailedLockUpdate(
        {
          reservationId: savedReservation.id,
          duveId: reservation._id,
          lockId: "unknown",
          propertyName: reservation.property.name,
          fullAddress,
          guestName,
          startDate: new Date(reservation.startDate).toISOString(),
          endDate: new Date(reservation.endDate).toISOString(),
          error: error.message,
        },
        dailyTaskRunId,
      );
    }
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

  return { success: true, lockUpdateFailed };
}

// Add configuration constants for parallel processing
const PARALLEL_PROCESSING_BATCH_SIZE = VERCEL_OPTIMIZATIONS.BATCH_SIZE; // Adaptive batch size based on environment
const MAX_RETRIES = 3;

// Add utility function for exponential backoff
function exponentialBackoff(attempt: number): number {
  return Math.min(1000 * Math.pow(2, attempt), 10000);
}

// Add retry logic for API calls
async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  maxRetries = MAX_RETRIES,
  operation = "API call",
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error(
          `${operation} failed after ${maxRetries} attempts:`,
          error,
        );
        throw error;
      }

      const delay = exponentialBackoff(attempt);
      console.warn(
        `${operation} failed (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms:`,
        error,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error(`Retry logic failed for ${operation}`);
}

// Optimized function to batch fetch lock profiles
async function batchFetchLockProfiles(
  reservations: Reservation[],
): Promise<Map<string, LockProfileWithPasswords>> {
  const lockProfiles = new Map<string, LockProfileWithPasswords>();

  // Extract unique street numbers and lock names
  const propertyKeys = reservations.map((reservation) => {
    const { streetNumber, lockName } = parsePropertyName(
      reservation.property.name,
    );
    return `${streetNumber}:${lockName}`;
  });

  const uniqueKeys = [...new Set(propertyKeys)];

  // Batch fetch lock profiles
  const lockProfilePromises = uniqueKeys.map(async (key) => {
    const [streetNumber, lockName] = key.split(":");
    const lockProfile = await db.lockProfile.findFirst({
      where: { streetNumber, lockName },
      include: {
        keyboardPasswords: {
          where: {
            keyboardPwdName: {
              in: [
                "Guest Code 1",
                "Guest Code 2",
                "Guest code 1",
                "Guest code 2",
                "guest code 1",
                "guest code 2",
              ],
            },
            status: 1,
            startDate: { not: null },
          },
          orderBy: { startDate: "asc" },
          take: 1,
        },
      },
    });
    if (lockProfile) {
      lockProfiles.set(key, lockProfile);
    }
  });

  await Promise.allSettled(lockProfilePromises);
  return lockProfiles;
}

// Add utility function for parallel processing with controlled concurrency
async function processReservationsBatch(
  reservations: Reservation[],
  dailyTaskRunId: string,
  batchSize: number = PARALLEL_PROCESSING_BATCH_SIZE,
): Promise<{ totalProcessed: number; totalLockUpdateFailures: number }> {
  let totalProcessed = 0;
  let totalLockUpdateFailures = 0;

  // Pre-fetch all lock profiles to reduce database queries
  console.log("Pre-fetching lock profiles...");
  const lockProfileMap = await batchFetchLockProfiles(reservations);
  console.log(`Fetched ${lockProfileMap.size} lock profiles`);

  // Process reservations in batches to avoid overwhelming the system
  for (let i = 0; i < reservations.length; i += batchSize) {
    const batch = reservations.slice(i, i + batchSize);
    console.log(
      `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(reservations.length / batchSize)} (${batch.length} reservations)...`,
    );

    // Process batch in parallel with pre-fetched lock profiles
    const results = await Promise.allSettled(
      batch.map((reservation) =>
        processReservationOptimized(
          reservation,
          dailyTaskRunId,
          lockProfileMap,
        ),
      ),
    );

    // Count results
    for (const result of results) {
      totalProcessed++;
      if (result.status === "fulfilled") {
        if (result.value.lockUpdateFailed) {
          totalLockUpdateFailures++;
        }
      } else {
        console.error("Reservation processing failed:", result.reason);
        totalLockUpdateFailures++;
      }
    }

    // Small delay between batches to prevent overwhelming the system
    if (i + batchSize < reservations.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, VERCEL_OPTIMIZATIONS.API_RATE_LIMIT_DELAY),
      );
    }
  }

  return { totalProcessed, totalLockUpdateFailures };
}

// Optimized reservation processing with pre-fetched data
async function processReservationOptimized(
  reservation: Reservation,
  dailyTaskRunId: string,
  lockProfileMap: Map<string, LockProfileWithPasswords>,
): Promise<{ success: boolean; lockUpdateFailed?: boolean }> {
  const { streetNumber, lockName } = parsePropertyName(
    reservation.property.name,
  );
  const lockProfileKey = `${streetNumber}:${lockName}`;
  const existingLockProfile = lockProfileMap.get(lockProfileKey);

  const fullAddress = `${reservation.property.streetNumber} ${reservation.property.street}, ${reservation.property.city}`;
  const guestName = `${reservation.firstName} ${reservation.lastName}`;

  let lockUpdateFailed = false;

  // Use the original processReservation logic but with pre-fetched lock profile
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
    propertyId: reservation.property._id,
    propertyName: reservation.property.name,
    propertyStreet: reservation.property.street,
    propertyStreetNumber: reservation.property.streetNumber,
    propertyCity: reservation.property.city,
    propertyStatus: reservation.property.status,
    propertyTags: reservation.property.tags,
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
      bookingStatus: reservation.bookingStatus ?? "unknown",
      bookingSource: reservation.bookingSourceLabel ?? "unknown",
    },
    update: {
      ...reservationData,
      bookingStatus: reservation.bookingStatus ?? "unknown",
      bookingSource: reservation.bookingSourceLabel ?? "unknown",
    },
  });

  // Handle lock profile processing with pre-fetched data
  try {
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
        const shouldUpdate = !TEST_MODE || isTestData(reservation);

        if (shouldUpdate) {
          // Check if this lock has already been successfully updated today
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);

          const existingUpdate = await db.successfulLockUpdate.findFirst({
            where: {
              lockId: existingLockProfile.lockId,
              createdAt: { gte: today, lt: tomorrow },
            },
          });

          if (existingUpdate) {
            console.log(
              `[LockProfile] Lock ${existingLockProfile.lockId} already updated today. Skipping.`,
            );
            await db.reservation.update({
              where: { id: savedReservation.id },
              data: { lockId: existingLockProfile.lockId },
            });
            return { success: true, lockUpdateFailed: false };
          }

          // Generate new lock code and update via API with retry logic
          const newLockCode = generateLockCode();
          const updateStartTime = Date.now();

          const updateResult = await retryApiCall(
            () =>
              updateLockCode(
                existingLockProfile.lockId!,
                newLockCode,
                new Date(reservation.startDate),
                new Date(reservation.endDate),
                reservation._id,
              ),
            MAX_RETRIES,
            `Lock code update for ${existingLockProfile.lockId}`,
          );

          const updateEndTime = Date.now();
          const processingTime = updateEndTime - updateStartTime;

          if (updateResult.success) {
            // Update both LockProfile and Reservation with the new lock code
            await Promise.all([
              db.lockProfile.update({
                where: { id: existingLockProfile.id },
                data: { lockCode: `#${newLockCode}` },
              }),
              db.reservation.update({
                where: { id: savedReservation.id },
                data: { lockId: existingLockProfile.lockId },
              }),
            ]);

            console.log(
              `[LockProfile] Successfully updated lock code for ${fullAddress} (${guestName})`,
            );

            // Log successful lock update
            await logSuccessfulLockUpdate(
              {
                reservationId: savedReservation.id,
                duveId: reservation._id,
                lockId: existingLockProfile.lockId,
                propertyName: reservation.property.name,
                fullAddress,
                guestName,
                startDate: new Date(reservation.startDate).toISOString(),
                endDate: new Date(reservation.endDate).toISOString(),
                lockCode: `#${newLockCode}`,
                lockCodeStart: new Date(reservation.startDate).toISOString(),
                lockCodeEnd: new Date(reservation.endDate).toISOString(),
                processingTime,
              },
              dailyTaskRunId,
            );
          } else {
            console.error(
              `[LockProfile] Failed to update lock code for ${fullAddress} (${guestName})`,
            );
            lockUpdateFailed = true;
            await logFailedLockUpdate(
              {
                reservationId: savedReservation.id,
                duveId: reservation._id,
                lockId: existingLockProfile.lockId,
                propertyName: reservation.property.name,
                fullAddress,
                guestName,
                startDate: new Date(reservation.startDate).toISOString(),
                endDate: new Date(reservation.endDate).toISOString(),
                error:
                  updateResult.errorDetails?.message ??
                  "Lock code update failed",
                errorDetails: updateResult.errorDetails,
              },
              dailyTaskRunId,
            );
          }
        }
      } else {
        await db.reservation.update({
          where: { id: savedReservation.id },
          data: { lockId: null },
        });
        console.warn(`[LockProfile] No lockId for property ${fullAddress}`);
      }
    } else {
      await db.reservation.update({
        where: { id: savedReservation.id },
        data: { lockId: null },
      });
      console.warn(`[LockProfile] No LockProfile found for ${fullAddress}`);
    }
  } catch (error) {
    console.error(`[LockProfile] Error processing ${fullAddress}:`, error);
    lockUpdateFailed = true;

    if (error instanceof Error) {
      await logFailedLockUpdate(
        {
          reservationId: savedReservation.id,
          duveId: reservation._id,
          lockId: existingLockProfile?.lockId ?? "unknown",
          propertyName: reservation.property.name,
          fullAddress,
          guestName,
          startDate: new Date(reservation.startDate).toISOString(),
          endDate: new Date(reservation.endDate).toISOString(),
          error: error.message,
        },
        dailyTaskRunId,
      );
    }
  }

  // Process guest profiles and documents in parallel
  const guestProfilePromise = processGuestProfiles(
    reservation,
    savedReservation.id,
  );
  const documentsPromise = processDocuments(reservation, savedReservation.id);

  await Promise.allSettled([guestProfilePromise, documentsPromise]);

  return { success: true, lockUpdateFailed };
}

// Helper function to process guest profiles
async function processGuestProfiles(
  reservation: Reservation,
  reservationId: string,
): Promise<void> {
  if (
    Array.isArray(reservation.guestProfiles) &&
    reservation.guestProfiles.length > 0
  ) {
    await db.guestProfile.deleteMany({ where: { reservationId } });
    await db.guestProfile.createMany({
      data: reservation.guestProfiles.map((profile: GuestProfile) => ({
        reservationId,
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
}

// Helper function to process documents
async function processDocuments(
  reservation: Reservation,
  reservationId: string,
): Promise<void> {
  if (
    Array.isArray(reservation.uploadedDocuments) &&
    reservation.uploadedDocuments.length > 0
  ) {
    await db.document.deleteMany({ where: { reservationId } });
    await db.document.createMany({
      data: reservation.uploadedDocuments.map((doc: UploadedDocument) => ({
        reservationId,
        name: doc.name,
        uploadDate: new Date(doc.uploadDate),
        documentType: doc.dtype,
        isSecureUpload: doc.isSecureUpload ?? false,
        duveDocumentId: doc._id,
      })),
    });
  }
}

// Process reservations for prep phase - creates PrepReservation records
async function processReservationsForPrep(
  reservations: Reservation[],
  dailyTaskRunId: string,
): Promise<{
  totalReservations: number;
  canUpdateCount: number;
  cannotUpdateCount: number;
}> {
  let totalReservations = 0;
  let canUpdateCount = 0;
  let cannotUpdateCount = 0;

  // Pre-fetch all lock profiles to reduce database queries
  console.log("Pre-fetching lock profiles...");
  const lockProfileMap = await batchFetchLockProfiles(reservations);
  console.log(`Fetched ${lockProfileMap.size} lock profiles`);

  // Process reservations in batches to avoid overwhelming the system
  const batchSize = PARALLEL_PROCESSING_BATCH_SIZE;
  for (let i = 0; i < reservations.length; i += batchSize) {
    const batch = reservations.slice(i, i + batchSize);
    console.log(
      `Processing prep batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(reservations.length / batchSize)} (${batch.length} reservations)...`,
    );

    // Process batch in parallel
    const results = await Promise.allSettled(
      batch.map((reservation) =>
        processReservationForPrep(reservation, dailyTaskRunId, lockProfileMap),
      ),
    );

    // Count results
    for (const result of results) {
      totalReservations++;
      if (result.status === "fulfilled") {
        if (result.value.canUpdate) {
          canUpdateCount++;
        } else {
          cannotUpdateCount++;
        }
      } else {
        console.error("Prep reservation processing failed:", result.reason);
        cannotUpdateCount++;
      }
    }

    // Small delay between batches
    if (i + batchSize < reservations.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, VERCEL_OPTIMIZATIONS.API_RATE_LIMIT_DELAY),
      );
    }
  }

  return { totalReservations, canUpdateCount, cannotUpdateCount };
}

// Process a single reservation for prep phase
async function processReservationForPrep(
  reservation: Reservation,
  dailyTaskRunId: string,
  lockProfileMap: Map<string, LockProfileWithPasswords>,
): Promise<{ canUpdate: boolean; reasonCannotUpdate?: string }> {
  const { streetNumber, lockName } = parsePropertyName(
    reservation.property.name,
  );
  const lockProfileKey = `${streetNumber}:${lockName}`;
  const existingLockProfile = lockProfileMap.get(lockProfileKey);

  const fullAddress = `${reservation.property.streetNumber} ${reservation.property.street}, ${reservation.property.city}`;
  const guestName = `${reservation.firstName} ${reservation.lastName}`;

  let canUpdate = false;
  let reasonCannotUpdate: string | undefined;
  let lockId: string | null | undefined;
  let currentLockCode: string | null | undefined;

  // First, create or update the reservation in the database
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
    propertyId: reservation.property._id,
    propertyName: reservation.property.name,
    propertyStreet: reservation.property.street,
    propertyStreetNumber: reservation.property.streetNumber,
    propertyCity: reservation.property.city,
    propertyStatus: reservation.property.status,
    propertyTags: reservation.property.tags,
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
      bookingStatus: reservation.bookingStatus ?? "unknown",
      bookingSource: reservation.bookingSourceLabel ?? "unknown",
    },
    update: {
      ...reservationData,
      bookingStatus: reservation.bookingStatus ?? "unknown",
      bookingSource: reservation.bookingSourceLabel ?? "unknown",
    },
  });

  // Handle lock profile processing
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
      lockId = existingLockProfile.lockId!;
      currentLockCode = existingLockProfile.lockCode;

      // Check if we should update this lock code
      const shouldUpdate = !TEST_MODE || isTestData(reservation);

      if (shouldUpdate) {
        // Check if this lock has already been successfully updated today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const existingUpdate = await db.successfulLockUpdate.findFirst({
          where: {
            lockId: existingLockProfile.lockId,
            createdAt: { gte: today, lt: tomorrow },
          },
        });

        if (existingUpdate) {
          canUpdate = false;
          reasonCannotUpdate = "Lock already updated today";
        } else {
          // Check if lock profile has valid keyboard passwords
          const hasValidKeyboardPassword =
            existingLockProfile.keyboardPasswords &&
            existingLockProfile.keyboardPasswords.length > 0;
          if (hasValidKeyboardPassword) {
            canUpdate = true;
          } else {
            canUpdate = false;
            reasonCannotUpdate = "No valid keyboard passwords found";
          }
        }
      } else {
        canUpdate = false;
        reasonCannotUpdate = "Test mode enabled and this is not test data";
      }

      // Update reservation with lockId
      await db.reservation.update({
        where: { id: savedReservation.id },
        data: { lockId: existingLockProfile.lockId },
      });
    } else {
      canUpdate = false;
      reasonCannotUpdate = "Lock profile exists but no lockId configured";

      await db.reservation.update({
        where: { id: savedReservation.id },
        data: { lockId: null },
      });
    }
  } else {
    canUpdate = false;
    reasonCannotUpdate = "No lock profile found for this property";

    await db.reservation.update({
      where: { id: savedReservation.id },
      data: { lockId: null },
    });
  }

  // Process guest profiles and documents in parallel
  const guestProfilePromise = processGuestProfiles(
    reservation,
    savedReservation.id,
  );
  const documentsPromise = processDocuments(reservation, savedReservation.id);
  await Promise.allSettled([guestProfilePromise, documentsPromise]);

  // Create PrepReservation record
  await db.prepReservation.create({
    data: {
      dailyTaskRunId,
      reservationId: savedReservation.id,
      duveId: reservation._id,
      propertyName: reservation.property.name,
      fullAddress,
      guestName,
      startDate: new Date(reservation.startDate),
      endDate: new Date(reservation.endDate),
      lockId,
      lockName,
      streetNumber,
      currentLockCode,
      isSelected: canUpdate, // Default to selected if can update
      canUpdate,
      reasonCannotUpdate,
      processed: false,
    },
  });

  console.log(
    `Prep: ${fullAddress} (${guestName}) - ${canUpdate ? "✅ Can update" : `❌ Cannot update: ${reasonCannotUpdate}`}`,
  );

  return { canUpdate, reasonCannotUpdate };
}

// Add optimized database batch operations (unused but kept for reference)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function batchUpsertReservations(
  reservations: Reservation[],
): Promise<Map<string, string>> {
  const reservationIdMap = new Map<string, string>();

  // Batch upsert reservations
  const reservationPromises = reservations.map(async (reservation) => {
    const reservationData = {
      duveId: reservation._id,
      firstName: reservation.firstName,
      lastName: reservation.lastName,
      email: reservation.email ?? null,
      phoneNumber: reservation.phoneNumber ?? null,
      status: reservation.status,
      bookingStatus: reservation.bookingStatus ?? "unknown",
      bookingSource: reservation.bookingSourceLabel ?? "unknown",
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
      propertyId: reservation.property._id,
      propertyName: reservation.property.name,
      propertyStreet: reservation.property.street,
      propertyStreetNumber: reservation.property.streetNumber,
      propertyCity: reservation.property.city,
      propertyStatus: reservation.property.status,
      propertyTags: reservation.property.tags,
      precheckinStatus: reservation.precheckin?.visited ? "visited" : null,
      verifiedEmail: reservation.precheckin?.verifiedEmail ?? null,
      verifiedPhone: reservation.precheckin?.verifiedPhone ?? null,
      arrivalMethod: reservation.precheckin?.arrivalMethod ?? null,
      passportUploaded: reservation.precheckin?.passportUploaded ?? false,
      creditCardUploaded: reservation.precheckin?.creditCardUploaded ?? false,
    };

    const savedReservation = await db.reservation.upsert({
      where: { duveId: reservation._id },
      create: reservationData,
      update: reservationData,
    });

    reservationIdMap.set(reservation._id, savedReservation.id);
    return savedReservation;
  });

  await Promise.allSettled(reservationPromises);
  return reservationIdMap;
}

// Function to check and kill tasks that have been running for too long
export async function killStuckTasks(): Promise<void> {
  const TIMEOUT_MINUTES = 60; // Kill tasks running for more than 60 minutes
  const timeoutThreshold = new Date(Date.now() - TIMEOUT_MINUTES * 60 * 1000);

  try {
    const stuckTasks = await db.dailyTaskRun.findMany({
      where: {
        status: "running",
        startTime: {
          lt: timeoutThreshold,
        },
      },
    });

    if (stuckTasks.length > 0) {
      console.log(`Found ${stuckTasks.length} stuck tasks. Killing them...`);

      for (const task of stuckTasks) {
        const endTime = new Date();
        const duration = endTime.getTime() - task.startTime.getTime();

        await db.dailyTaskRun.update({
          where: { id: task.id },
          data: {
            endTime,
            duration,
            status: "killed",
            error: `Task was automatically killed after running for ${Math.round(duration / 1000 / 60)} minutes`,
          },
        });

        console.log(
          `Killed stuck task ${task.id} (running for ${Math.round(duration / 1000 / 60)} minutes)`,
        );
      }
    }
  } catch (error) {
    console.error("Error killing stuck tasks:", error);
  }
}

// Function that will be executed daily (legacy - full process)
export async function dailyTask(): Promise<void> {
  const startTime = new Date();
  let dailyTaskRun;

  try {
    console.log("Running daily task...");

    // First, check and kill any stuck tasks
    await killStuckTasks();

    // Create a DailyTaskRun record
    dailyTaskRun = await db.dailyTaskRun.create({
      data: {
        startTime,
        status: "running",
        taskType: "full",
      },
    });

    // Pre-warm configuration cache for better performance
    await prewarmConfigCache();

    // Refresh lock profile data before processing reservations
    console.log("Refreshing lock profile data...");
    await refreshLockProfileData();
    console.log("Lock profile data refresh completed.");

    // Get today's date in ISO format
    const today = new Date();
    today.setHours(16, 0, 0, 0); // Set to 16:00:00 UTC

    let currentPage = 1;
    let totalProcessed = 0;
    let totalLockUpdateFailures = 0;
    let hasMore = true;
    const allReservations: Reservation[] = [];

    // First, collect all reservations from all pages
    console.log("Fetching all reservations...");
    while (hasMore) {
      console.log(`Fetching page ${currentPage}...`);
      const data = await fetchReservationsPage(currentPage, today);
      allReservations.push(...data.reservations);

      console.log(
        `Fetched ${data.reservations.length} reservations from page ${currentPage}`,
      );

      // Check if there are more pages
      hasMore = data.pagination.hasMore;
      if (hasMore) {
        currentPage++;
      }
    }

    console.log(`Total reservations to process: ${allReservations.length}`);

    // Process reservations in parallel batches
    const batchResults = await processReservationsBatch(
      allReservations,
      dailyTaskRun.id,
    );
    totalProcessed = batchResults.totalProcessed;
    totalLockUpdateFailures = batchResults.totalLockUpdateFailures;

    // Update the DailyTaskRun with final statistics
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();
    const successfulUpdates = totalProcessed - totalLockUpdateFailures;

    await db.dailyTaskRun.update({
      where: { id: dailyTaskRun.id },
      data: {
        endTime,
        duration,
        status: "completed",
        totalReservations: totalProcessed,
        successfulUpdates,
        failedUpdates: totalLockUpdateFailures,
      },
    });

    // Provide detailed summary
    console.log(`\n=== Daily Task Summary ===`);
    console.log(`Total reservations processed: ${totalProcessed}`);
    console.log(`Lock code update failures: ${totalLockUpdateFailures}`);
    console.log(`Successful lock code updates: ${successfulUpdates}`);
    console.log(`Total execution time: ${Math.round(duration / 1000)} seconds`);

    if (totalLockUpdateFailures > 0) {
      console.log(
        `⚠️  ${totalLockUpdateFailures} lock code updates failed. Check logs/failed-lock-updates.json for details.`,
      );
      console.log(
        `💡 Run 'npx tsx scripts/retry-failed-locks.ts' to retry failed lock updates.`,
      );
    } else {
      console.log(`✅ All lock code updates completed successfully!`);
    }
  } catch (error) {
    console.error("Error in daily task:", error);

    // Update the DailyTaskRun to mark it as failed
    if (dailyTaskRun) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      await db.dailyTaskRun.update({
        where: { id: dailyTaskRun.id },
        data: {
          endTime,
          duration,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          errorStack:
            error instanceof Error ? (error.stack ?? undefined) : undefined,
        },
      });
    }
  }
}

// Prep phase - fetch reservations, update lock profiles, analyze what can be updated
export async function prepDailyTask(): Promise<string> {
  const startTime = new Date();
  let dailyTaskRun;

  try {
    console.log("Running prep daily task...");

    // First, check and kill any stuck tasks
    await killStuckTasks();

    // Create a DailyTaskRun record for prep phase
    dailyTaskRun = await db.dailyTaskRun.create({
      data: {
        startTime,
        status: "running",
        taskType: "prep",
      },
    });

    // Pre-warm configuration cache for better performance
    await prewarmConfigCache();

    // Refresh lock profile data before processing reservations
    console.log("Refreshing lock profile data...");
    await refreshLockProfileData();
    console.log("Lock profile data refresh completed.");

    // Get today's date in ISO format
    const today = new Date();
    today.setHours(16, 0, 0, 0); // Set to 16:00:00 UTC

    let currentPage = 1;
    let hasMore = true;
    const allReservations: Reservation[] = [];

    // First, collect all reservations from all pages
    console.log("Fetching all reservations...");
    while (hasMore) {
      console.log(`Fetching page ${currentPage}...`);
      const data = await fetchReservationsPage(currentPage, today);
      allReservations.push(...data.reservations);

      console.log(
        `Fetched ${data.reservations.length} reservations from page ${currentPage}`,
      );

      // Check if there are more pages
      hasMore = data.pagination.hasMore;
      if (hasMore) {
        currentPage++;
      }
    }

    console.log(`Total reservations to process: ${allReservations.length}`);

    // Process reservations and create PrepReservation records
    const prepResults = await processReservationsForPrep(
      allReservations,
      dailyTaskRun.id,
    );

    // Update the DailyTaskRun with final statistics
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    await db.dailyTaskRun.update({
      where: { id: dailyTaskRun.id },
      data: {
        endTime,
        duration,
        status: "completed",
        totalReservations: prepResults.totalReservations,
        successfulUpdates: 0, // No updates in prep phase
        failedUpdates: 0, // No updates in prep phase
      },
    });

    // Provide detailed summary
    console.log(`\n=== Prep Task Summary ===`);
    console.log(
      `Total reservations processed: ${prepResults.totalReservations}`,
    );
    console.log(
      `Reservations that can be updated: ${prepResults.canUpdateCount}`,
    );
    console.log(
      `Reservations that cannot be updated: ${prepResults.cannotUpdateCount}`,
    );
    console.log(`Total execution time: ${Math.round(duration / 1000)} seconds`);

    return dailyTaskRun.id;
  } catch (error) {
    console.error("Error in prep daily task:", error);

    // Update the DailyTaskRun to mark it as failed
    if (dailyTaskRun) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      await db.dailyTaskRun.update({
        where: { id: dailyTaskRun.id },
        data: {
          endTime,
          duration,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          errorStack:
            error instanceof Error ? (error.stack ?? undefined) : undefined,
        },
      });
    }

    throw error;
  }
}

// Execute phase - update lock codes for selected reservations
export async function executeLockCodeUpdates(
  prepTaskRunId: string,
): Promise<void> {
  const startTime = new Date();
  let dailyTaskRun;

  try {
    console.log("Running execute lock code updates...");

    // Create a DailyTaskRun record for execute phase
    dailyTaskRun = await db.dailyTaskRun.create({
      data: {
        startTime,
        status: "running",
        taskType: "execute",
      },
    });

    // Get selected prep reservations
    const selectedReservations = await db.prepReservation.findMany({
      where: {
        dailyTaskRunId: prepTaskRunId,
        isSelected: true,
        canUpdate: true,
        processed: false,
      },
    });

    console.log(
      `Found ${selectedReservations.length} reservations to update lock codes for`,
    );

    let totalSuccessful = 0;
    let totalFailed = 0;

    // Process each selected reservation
    for (const prepReservation of selectedReservations) {
      try {
        if (!prepReservation.lockId) {
          console.warn(
            `Skipping reservation ${prepReservation.id} - no lockId`,
          );
          continue;
        }

        // Generate new lock code
        const newLockCode = generateLockCode();
        const updateStartTime = Date.now();

        // Update the lock code
        const updateResult = await updateLockCode(
          prepReservation.lockId,
          newLockCode,
          prepReservation.startDate,
          prepReservation.endDate,
          prepReservation.duveId,
        );

        const updateEndTime = Date.now();
        const processingTime = updateEndTime - updateStartTime;

        if (updateResult.success) {
          // Log successful update
          await logSuccessfulLockUpdate(
            {
              reservationId: prepReservation.reservationId,
              duveId: prepReservation.duveId,
              lockId: prepReservation.lockId,
              propertyName: prepReservation.propertyName,
              fullAddress: prepReservation.fullAddress,
              guestName: prepReservation.guestName,
              startDate: prepReservation.startDate.toISOString(),
              endDate: prepReservation.endDate.toISOString(),
              lockCode: `#${newLockCode}`,
              lockCodeStart: prepReservation.startDate.toISOString(),
              lockCodeEnd: prepReservation.endDate.toISOString(),
              processingTime,
            },
            dailyTaskRun.id,
          );

          totalSuccessful++;
          console.log(
            `✅ Successfully updated lock code for ${prepReservation.fullAddress} (${prepReservation.guestName})`,
          );
        } else {
          // Log failed update
          await logFailedLockUpdate(
            {
              reservationId: prepReservation.reservationId,
              duveId: prepReservation.duveId,
              lockId: prepReservation.lockId,
              propertyName: prepReservation.propertyName,
              fullAddress: prepReservation.fullAddress,
              guestName: prepReservation.guestName,
              startDate: prepReservation.startDate.toISOString(),
              endDate: prepReservation.endDate.toISOString(),
              error:
                updateResult.errorDetails?.message ?? "Lock code update failed",
              errorDetails: updateResult.errorDetails,
            },
            dailyTaskRun.id,
          );

          totalFailed++;
          console.error(
            `❌ Failed to update lock code for ${prepReservation.fullAddress} (${prepReservation.guestName})`,
          );
        }

        // Mark as processed
        await db.prepReservation.update({
          where: { id: prepReservation.id },
          data: {
            processed: true,
            processedAt: new Date(),
          },
        });
      } catch (error) {
        console.error(
          `Error processing reservation ${prepReservation.id}:`,
          error,
        );
        totalFailed++;

        // Log failed update
        await logFailedLockUpdate(
          {
            reservationId: prepReservation.reservationId,
            duveId: prepReservation.duveId,
            lockId: prepReservation.lockId ?? "unknown",
            propertyName: prepReservation.propertyName,
            fullAddress: prepReservation.fullAddress,
            guestName: prepReservation.guestName,
            startDate: prepReservation.startDate.toISOString(),
            endDate: prepReservation.endDate.toISOString(),
            error: error instanceof Error ? error.message : "Unknown error",
          },
          dailyTaskRun.id,
        );
      }
    }

    // Update the DailyTaskRun with final statistics
    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    await db.dailyTaskRun.update({
      where: { id: dailyTaskRun.id },
      data: {
        endTime,
        duration,
        status: "completed",
        totalReservations: selectedReservations.length,
        successfulUpdates: totalSuccessful,
        failedUpdates: totalFailed,
      },
    });

    // Provide detailed summary
    console.log(`\n=== Execute Task Summary ===`);
    console.log(`Total reservations processed: ${selectedReservations.length}`);
    console.log(`Successful lock code updates: ${totalSuccessful}`);
    console.log(`Failed lock code updates: ${totalFailed}`);
    console.log(`Total execution time: ${Math.round(duration / 1000)} seconds`);

    if (totalFailed > 0) {
      console.log(
        `⚠️  ${totalFailed} lock code updates failed. Check logs/failed-lock-updates.json for details.`,
      );
    } else {
      console.log(`✅ All lock code updates completed successfully!`);
    }
  } catch (error) {
    console.error("Error in execute lock code updates:", error);

    // Update the DailyTaskRun to mark it as failed
    if (dailyTaskRun) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      await db.dailyTaskRun.update({
        where: { id: dailyTaskRun.id },
        data: {
          endTime,
          duration,
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          errorStack:
            error instanceof Error ? (error.stack ?? undefined) : undefined,
        },
      });
    }

    throw error;
  }
}

// Schedule the task to run at midnight every day
export function startDailyCron() {
  // Schedule the task to run at 1:30 PM EDT (5:30 PM UTC) every day
  // Note: This assumes the server is running in UTC timezone
  // If the server is in a different timezone, adjust the cron expression accordingly
  cron.schedule("30 17 * * *", () => {
    void dailyTask();
  });

  // Schedule stuck task cleanup every 30 minutes
  cron.schedule("*/30 * * * *", () => {
    void killStuckTasks();
  });

  console.log("Daily cron job scheduled for 1:30 PM EDT (5:30 PM UTC)");
  console.log("Stuck task cleanup scheduled (every 30 minutes)");
  console.log(
    "⚠️  Note: Ensure server timezone is set to UTC for correct timing",
  );
}

// Utility function to log failed lock updates
export interface FailedLockUpdate {
  reservationId: string;
  duveId: string;
  lockId: string;
  propertyName: string;
  fullAddress: string;
  guestName: string;
  startDate: string;
  endDate: string;
  error: string;
  errorDetails?: {
    type: "sifely_api" | "duve_api" | "network" | "database" | "unknown";
    apiResponse?: {
      code?: number;
      msg?: string;
      errcode?: number;
      errmsg?: string;
      description?: string;
    };
    httpStatus?: number;
  };
  timestamp: string;
}

// Interface for successful lock updates
export interface SuccessfulLockUpdate {
  reservationId: string;
  duveId: string;
  lockId: string;
  propertyName: string;
  fullAddress: string;
  guestName: string;
  startDate: string;
  endDate: string;
  lockCode: string;
  lockCodeStart: string;
  lockCodeEnd: string;
  processingTime?: number;
}

export async function logFailedLockUpdate(
  failedUpdate: Omit<FailedLockUpdate, "timestamp">,
  dailyTaskRunId: string,
): Promise<void> {
  const timestamp = new Date().toISOString();
  const logEntry: FailedLockUpdate = {
    ...failedUpdate,
    timestamp,
  };

  // Store in database
  try {
    await db.failedLockUpdate.create({
      data: {
        dailyTaskRunId,
        reservationId: failedUpdate.reservationId,
        duveId: failedUpdate.duveId,
        lockId: failedUpdate.lockId,
        propertyName: failedUpdate.propertyName,
        fullAddress: failedUpdate.fullAddress,
        guestName: failedUpdate.guestName,
        startDate: new Date(failedUpdate.startDate),
        endDate: new Date(failedUpdate.endDate),
        error: failedUpdate.error,
        errorType: failedUpdate.errorDetails?.type ?? "unknown",
        errorDetails: failedUpdate.errorDetails ?? {},
      },
    });
    console.log(`[FailedLockLogger] Logged failed lock update to database`);
  } catch (error) {
    console.error(
      "Failed to create database record for failed lock update:",
      error,
    );
  }

  // Also keep the file logging for backward compatibility (only in non-serverless environments)
  const isServerless =
    process.env.VERCEL ??
    process.env.AWS_LAMBDA_FUNCTION_NAME ??
    process.env.FUNCTION_NAME;

  if (!isServerless) {
    const logsDir = join(process.cwd(), "logs");
    const failedLocksFile = join(logsDir, "failed-lock-updates.json");

    // Create logs directory if it doesn't exist
    if (!existsSync(logsDir)) {
      try {
        mkdirSync(logsDir, { recursive: true });
      } catch (error) {
        console.error("Failed to create logs directory:", error);
        console.log(
          "[FailedLockLogger] Skipping file logging due to filesystem restrictions",
        );
        return;
      }
    }

    // Read existing failed locks or create new array
    let failedLocks: FailedLockUpdate[] = [];
    if (existsSync(failedLocksFile)) {
      try {
        const fileContent = readFileSync(failedLocksFile, "utf8");
        failedLocks = JSON.parse(fileContent) as FailedLockUpdate[];
      } catch (error) {
        console.error("Failed to read existing failed locks file:", error);
        failedLocks = [];
      }
    }

    // Add new failed lock
    failedLocks.push(logEntry);

    // Write back to file
    try {
      writeFileSync(failedLocksFile, JSON.stringify(failedLocks, null, 2));
      console.log(
        `[FailedLockLogger] Logged failed lock update to ${failedLocksFile}`,
      );
    } catch (error) {
      console.error("Failed to write failed locks file:", error);
    }
  } else {
    console.log(
      "[FailedLockLogger] Skipping file logging in serverless environment (logged to database)",
    );
  }
}

// Function to log successful lock updates to the database
export async function logSuccessfulLockUpdate(
  successfulUpdate: SuccessfulLockUpdate,
  dailyTaskRunId: string,
): Promise<void> {
  try {
    await db.successfulLockUpdate.create({
      data: {
        dailyTaskRunId,
        reservationId: successfulUpdate.reservationId,
        duveId: successfulUpdate.duveId,
        lockId: successfulUpdate.lockId,
        propertyName: successfulUpdate.propertyName,
        fullAddress: successfulUpdate.fullAddress,
        guestName: successfulUpdate.guestName,
        startDate: new Date(successfulUpdate.startDate),
        endDate: new Date(successfulUpdate.endDate),
        lockCode: successfulUpdate.lockCode,
        lockCodeStart: new Date(successfulUpdate.lockCodeStart),
        lockCodeEnd: new Date(successfulUpdate.lockCodeEnd),
        processingTime: successfulUpdate.processingTime,
      },
    });
    console.log(
      `[SuccessfulLockLogger] Logged successful lock update to database`,
    );
  } catch (error) {
    console.error(
      "Failed to create database record for successful lock update:",
      error,
    );
  }
}
