import cron from "node-cron";
import { db } from "../db";
import { writeFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { getConfigWithFallback } from "../config";

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

    const response = await fetch(
      "https://pro-server.sifely.com/v3/keyboardPwd/change",
      {
        method: "POST",
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

// Function to process a single reservation
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

// Function that will be executed daily
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
      },
    });

    // Get today's date in ISO format
    const today = new Date();
    today.setHours(16, 0, 0, 0); // Set to 16:00:00 UTC

    let currentPage = 1;
    let totalProcessed = 0;
    let totalLockUpdateFailures = 0;
    let hasMore = true;

    while (hasMore) {
      console.log(`Fetching page ${currentPage}...`);
      const data = await fetchReservationsPage(currentPage, today);

      // Process each reservation in the current page
      for (const reservation of data.reservations) {
        const result = await processReservation(reservation, dailyTaskRun.id);
        totalProcessed++;

        if (result.lockUpdateFailed) {
          totalLockUpdateFailures++;
        }
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
          errorStack: error instanceof Error ? error.stack : undefined,
        },
      });
    }
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

  // Also keep the file logging for backward compatibility
  const logsDir = join(process.cwd(), "logs");
  const failedLocksFile = join(logsDir, "failed-lock-updates.json");

  // Create logs directory if it doesn't exist
  if (!existsSync(logsDir)) {
    try {
      mkdirSync(logsDir, { recursive: true });
    } catch (error) {
      console.error("Failed to create logs directory:", error);
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
