import { db } from "../src/server/db";
import {
  updateLockCode,
  type LockUpdateResult,
} from "../src/server/cron/daily";
import readline from "readline";
import { getConfigWithFallback } from "../src/server/config";

interface ManualLockUpdateParams {
  lockId: string;
  passcode: string;
  startDate: Date;
  endDate: Date;
  duveId?: string;
  skipDuveUpdate?: boolean;
}

// Helper function to create readline interface
function createReadlineInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

// Helper function to prompt for input
function promptUser(question: string): Promise<string> {
  const rl = createReadlineInterface();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Function to validate date format (YYYY-MM-DD or YYYY-MM-DD HH:MM)
function parseDate(dateStr: string): Date {
  // Try parsing as YYYY-MM-DD HH:MM first
  let date = new Date(dateStr);

  // If invalid, try parsing as YYYY-MM-DD and default to specific times
  if (isNaN(date.getTime())) {
    const datePart = dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
    if (datePart) {
      date = new Date(dateStr + "T00:00:00.000Z");
    }
  }

  if (isNaN(date.getTime())) {
    throw new Error(
      `Invalid date format: ${dateStr}. Use YYYY-MM-DD or YYYY-MM-DD HH:MM`,
    );
  }

  return date;
}

// Function to validate passcode format
function validatePasscode(passcode: string): string {
  // Remove any # prefix if present
  const cleanCode = passcode.replace(/^#/, "");

  // Check if it's 4 digits
  if (!/^\d{4}$/.test(cleanCode)) {
    throw new Error("Passcode must be 4 digits");
  }

  return cleanCode;
}

// Function to get lock profile details for logging
async function getLockProfileDetails(lockId: string) {
  console.log(`\n🔍 Fetching lock profile details for lockId: ${lockId}`);

  const lockProfile = await db.lockProfile.findFirst({
    where: { lockId },
    include: {
      reservation: true,
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
        take: 5, // Get more for debugging
      },
    },
  });

  if (!lockProfile) {
    console.log(`❌ No lock profile found for lockId: ${lockId}`);
    return null;
  }

  console.log(`✅ Lock Profile Found:`);
  console.log(`   - ID: ${lockProfile.id}`);
  console.log(`   - Property: ${lockProfile.fullPropertyName}`);
  console.log(`   - Street Number: ${lockProfile.streetNumber}`);
  console.log(`   - Lock Name: ${lockProfile.lockName}`);
  console.log(`   - Current Lock Code: ${lockProfile.lockCode || "None"}`);
  console.log(`   - Created: ${lockProfile.createdAt.toISOString()}`);
  console.log(`   - Updated: ${lockProfile.updatedAt.toISOString()}`);

  if (lockProfile.reservation) {
    console.log(`   - Linked Reservation: ${lockProfile.reservation.id}`);
    console.log(
      `   - Guest: ${lockProfile.reservation.firstName} ${lockProfile.reservation.lastName}`,
    );
    console.log(`   - Duve ID: ${lockProfile.reservation.duveId}`);
    console.log(
      `   - Check-in: ${lockProfile.reservation.startDate.toISOString()}`,
    );
    console.log(
      `   - Check-out: ${lockProfile.reservation.endDate.toISOString()}`,
    );
  } else {
    console.log(`   - No linked reservation`);
  }

  console.log(
    `   - Keyboard Passwords Found: ${lockProfile.keyboardPasswords.length}`,
  );
  lockProfile.keyboardPasswords.forEach((pwd, index) => {
    console.log(
      `     ${index + 1}. ID: ${pwd.keyboardPwdId}, Name: "${pwd.keyboardPwdName}"`,
    );
    console.log(`        Code: ${pwd.keyboardPwd}, Status: ${pwd.status}`);
    console.log(`        Start: ${pwd.startDate?.toISOString() || "None"}`);
    console.log(`        End: ${pwd.endDate?.toISOString() || "None"}`);
    console.log(
      `        Version: ${pwd.keyboardPwdVersion}, Type: ${pwd.keyboardPwdType}`,
    );
  });

  return lockProfile;
}

// Function to log the update attempt details
function logUpdateAttempt(params: ManualLockUpdateParams) {
  console.log(`\n📝 UPDATE ATTEMPT DETAILS:`);
  console.log(`   - Lock ID: ${params.lockId}`);
  console.log(`   - New Passcode: ${params.passcode}`);
  console.log(`   - Start Date: ${params.startDate.toISOString()}`);
  console.log(`   - End Date: ${params.endDate.toISOString()}`);
  console.log(`   - Duve ID: ${params.duveId || "None provided"}`);
  console.log(`   - Skip Duve Update: ${params.skipDuveUpdate ? "Yes" : "No"}`);
  console.log(
    `   - Timezone: UTC (times will be adjusted for EDT check-in/out)`,
  );
}

// Function to update only the lock code (skip Duve update)
async function updateLockCodeOnly(
  lockId: string,
  newCode: string,
  startDate: Date,
  endDate: Date,
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
    const checkInTime = new Date(startDate);
    checkInTime.setUTCHours(19, 0, 0, 0); // 3 PM EDT = 19:00 UTC

    const checkOutTime = new Date(endDate);
    checkOutTime.setUTCHours(15, 0, 0, 0); // 11 AM EDT = 15:00 UTC

    console.log(
      `[LockProfile] Updating keyboard password ID: ${keyboardPassword.keyboardPwdId}`,
    );
    console.log(
      `[LockProfile] Current password: ${keyboardPassword.keyboardPwd}`,
    );
    console.log(`[LockProfile] New password: ${newCode}`);
    console.log(`[LockProfile] New start time: ${checkInTime.toISOString()}`);
    console.log(`[LockProfile] New end time: ${checkOutTime.toISOString()}`);

    // Get configuration values from database with fallback to environment variables
    const sifelyAuthToken = await getConfigWithFallback("SIFELY_AUTH_TOKEN");

    const response = await fetch(
      "https://pro-server.sifely.com/v3/keyboardPwd/change",
      {
        method: "POST",
        headers: {
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
          Authorization: sifelyAuthToken || "",
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
          keyboardPwdName: keyboardPassword.keyboardPwdName,
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

    console.log(
      `[LockProfile] Sifely API Response:`,
      JSON.stringify(apiResponse, null, 2),
    );

    if (apiResponse.code !== 200) {
      console.error(
        `[LockProfile] Sifely API Error - Request failed:`,
        apiResponse,
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
      console.error(`[LockProfile] Sifely API Error - Operation failed:`, {
        errcode: apiResponse.data.errcode,
        errmsg: apiResponse.data.errmsg,
        description: apiResponse.data.description,
      });
      console.error(
        `[LockProfile] ❌ Lock update failed: ${apiResponse.data.errmsg}`,
      );
      return {
        success: false,
        errorDetails: {
          type: "sifely_api",
          message: apiResponse.data.errmsg || "Lock operation failed",
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

    console.log(
      `[LockProfile] ✅ Successfully updated lock code via Sifely API`,
    );

    // Update the KeyboardPassword record in the database
    await db.keyboardPassword.update({
      where: { keyboardPwdId: keyboardPassword.keyboardPwdId },
      data: {
        keyboardPwd: newCode,
        startDate: checkInTime,
        endDate: checkOutTime,
      },
    });

    console.log(`[LockProfile] ✅ Successfully updated database record`);

    return { success: true };
  } catch (error) {
    console.error(`[LockProfile] Error updating lock code:`, error);
    return {
      success: false,
      errorDetails: {
        type: "unknown",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
    };
  }
}

// Wrapper function to update lock code with optional Duve skip
async function updateLockCodeWithOptions(
  lockId: string,
  newCode: string,
  startDate: Date,
  endDate: Date,
  duveId?: string,
  skipDuveUpdate?: boolean,
): Promise<LockUpdateResult> {
  try {
    if (skipDuveUpdate) {
      console.log(
        `[LockProfile] ⏭️  Skipping Duve reservation update as requested`,
      );
      const result = await updateLockCodeOnly(
        lockId,
        newCode,
        startDate,
        endDate,
      );

      if (result.success) {
        console.log(
          `[LockProfile] ✅ Lock code updated successfully (Duve update skipped)`,
        );
      } else {
        console.error(
          `[LockProfile] ❌ Lock code update failed:`,
          result.errorDetails,
        );
      }

      return result;
    } else {
      // Call the updated updateLockCode function from daily.ts
      const result = await updateLockCode(
        lockId,
        newCode,
        startDate,
        endDate,
        duveId || "manual-update",
      );

      if (result.success) {
        console.log(
          `[LockProfile] ✅ Lock code and Duve reservation updated successfully`,
        );
      } else {
        console.error(
          `[LockProfile] ❌ Lock code update failed:`,
          result.errorDetails,
        );
      }

      return result;
    }
  } catch (error) {
    console.error(`[LockProfile] Error updating lock code:`, error);
    return {
      success: false,
      errorDetails: {
        type: "unknown",
        message:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
    };
  }
}

// Function to prompt for all parameters interactively
async function promptForParameters(): Promise<ManualLockUpdateParams> {
  console.log(`\n📋 Please provide the following information:`);

  const lockId = await promptUser("Lock ID: ");
  if (!lockId) {
    throw new Error("Lock ID is required");
  }

  const passcodeInput = await promptUser(
    "New passcode (4 digits, # optional): ",
  );
  const passcode = validatePasscode(passcodeInput);

  const startDateInput = await promptUser(
    "Start date (YYYY-MM-DD or YYYY-MM-DD HH:MM): ",
  );
  const startDate = parseDate(startDateInput);

  const endDateInput = await promptUser(
    "End date (YYYY-MM-DD or YYYY-MM-DD HH:MM): ",
  );
  const endDate = parseDate(endDateInput);

  const duveId = await promptUser("Duve ID (optional, press Enter to skip): ");

  const skipDuveUpdateInput = await promptUser(
    "Skip Duve reservation update? (y/N): ",
  );
  const skipDuveUpdate =
    skipDuveUpdateInput.toLowerCase() === "y" ||
    skipDuveUpdateInput.toLowerCase() === "yes";

  // Validate date range
  if (endDate <= startDate) {
    throw new Error("End date must be after start date");
  }

  return {
    lockId,
    passcode,
    startDate,
    endDate,
    duveId: duveId || undefined,
    skipDuveUpdate,
  };
}

// Function to parse command line arguments
function parseCommandLineArgs(): Partial<ManualLockUpdateParams> {
  const args = process.argv.slice(2);
  const params: Partial<ManualLockUpdateParams> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Handle boolean flags
    if (arg === "--skipDuveUpdate" || arg === "--skip-duve") {
      params.skipDuveUpdate = true;
      continue;
    }

    // Handle key-value pairs
    const value = args[i + 1];
    if (!value || value.startsWith("-")) continue;

    switch (arg) {
      case "--lockId":
      case "-l":
        params.lockId = value;
        i++; // Skip the value on next iteration
        break;
      case "--passcode":
      case "-p":
        params.passcode = validatePasscode(value);
        i++; // Skip the value on next iteration
        break;
      case "--startDate":
      case "-s":
        params.startDate = parseDate(value);
        i++; // Skip the value on next iteration
        break;
      case "--endDate":
      case "-e":
        params.endDate = parseDate(value);
        i++; // Skip the value on next iteration
        break;
      case "--duveId":
      case "-d":
        params.duveId = value;
        i++; // Skip the value on next iteration
        break;
    }
  }

  return params;
}

// Main function
async function manualLockUpdate(): Promise<void> {
  try {
    console.log(`🔧 Manual Lock Update Script Started`);
    console.log(`⏰ Current time: ${new Date().toISOString()}`);

    // Try to get parameters from command line first
    const cmdParams = parseCommandLineArgs();
    let params: ManualLockUpdateParams;

    if (
      cmdParams.lockId &&
      cmdParams.passcode &&
      cmdParams.startDate &&
      cmdParams.endDate
    ) {
      // All required params provided via command line
      params = cmdParams as ManualLockUpdateParams;
      console.log(`\n✅ Using command line parameters`);
    } else {
      // Interactive mode
      console.log(
        `\n🎯 Interactive mode - some or all parameters missing from command line`,
      );
      if (cmdParams.lockId) {
        console.log(`   - Lock ID from command line: ${cmdParams.lockId}`);
      }
      params = await promptForParameters();
    }

    console.log(`\n🔍 STEP 1: Validating lock profile...`);
    const lockProfile = await getLockProfileDetails(params.lockId);

    if (!lockProfile) {
      console.log(`❌ Script terminated: Lock profile not found`);
      return;
    }

    // If no duveId provided and we have a linked reservation, use that
    if (!params.duveId && lockProfile.reservation) {
      params.duveId = lockProfile.reservation.duveId;
      console.log(
        `\n📎 Using Duve ID from linked reservation: ${params.duveId}`,
      );
    }

    console.log(`\n🔍 STEP 2: Logging update attempt details...`);
    logUpdateAttempt(params);

    // Ask for confirmation
    const confirmInput = await promptUser(
      "\nProceed with lock update? (y/N): ",
    );
    if (
      confirmInput.toLowerCase() !== "y" &&
      confirmInput.toLowerCase() !== "yes"
    ) {
      console.log(`❌ Update cancelled by user`);
      return;
    }

    console.log(`\n🚀 STEP 3: Attempting lock code update...`);
    const startTime = Date.now();

    const result = await updateLockCodeWithOptions(
      params.lockId,
      params.passcode,
      params.startDate,
      params.endDate,
      params.duveId,
      params.skipDuveUpdate,
    );

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`\n⏱️  Update completed in ${duration}ms`);

    if (result.success) {
      console.log(`✅ LOCK UPDATE SUCCESSFUL!`);

      // Fetch updated lock profile to show changes
      console.log(`\n🔍 STEP 4: Verifying changes...`);
      await getLockProfileDetails(params.lockId);
    } else {
      console.log(`❌ LOCK UPDATE FAILED!`);
      console.log(`   Check the logs above for detailed error information`);

      if (result.errorDetails) {
        console.log(`\n📋 ERROR SUMMARY:`);
        console.log(`   - Type: ${result.errorDetails.type}`);
        console.log(`   - Message: ${result.errorDetails.message}`);

        if (result.errorDetails.apiResponse) {
          console.log(
            `   - API Error Code: ${result.errorDetails.apiResponse.errcode || result.errorDetails.apiResponse.code}`,
          );
          console.log(
            `   - API Error Message: ${result.errorDetails.apiResponse.errmsg || result.errorDetails.apiResponse.msg}`,
          );
          if (result.errorDetails.apiResponse.description) {
            console.log(
              `   - Description: ${result.errorDetails.apiResponse.description}`,
            );
          }
        }
      }
    }
  } catch (error) {
    console.error(`\n💥 SCRIPT ERROR:`, error);
    if (error instanceof Error) {
      console.error(`   Message: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    }
  } finally {
    console.log(`\n🔌 Disconnecting from database...`);
    await db.$disconnect();
    console.log(`✅ Script completed`);
  }
}

// Usage instructions
function printUsage() {
  console.log(`
🔧 Manual Lock Update Script

USAGE:
  Interactive mode:
    npx tsx scripts/manual-lock-update.ts

  Command line mode:
    npx tsx scripts/manual-lock-update.ts --lockId <id> --passcode <code> --startDate <date> --endDate <date> [--duveId <id>] [--skipDuveUpdate]

PARAMETERS:
  --lockId, -l          Lock ID (required)
  --passcode, -p        4-digit passcode (required)
  --startDate, -s       Start date in YYYY-MM-DD or YYYY-MM-DD HH:MM format (required)
  --endDate, -e         End date in YYYY-MM-DD or YYYY-MM-DD HH:MM format (required)
  --duveId, -d          Duve reservation ID (optional)
  --skipDuveUpdate      Skip updating Duve reservation (optional flag)
  --skip-duve           Alias for --skipDuveUpdate (optional flag)

EXAMPLES:
  npx tsx scripts/manual-lock-update.ts --lockId 1234567 --passcode 9876 --startDate 2024-01-15 --endDate 2024-01-17
  npx tsx scripts/manual-lock-update.ts -l 1234567 -p 9876 -s "2024-01-15 15:00" -e "2024-01-17 11:00" -d cmcjfragk00pu070w964sln4r
  npx tsx scripts/manual-lock-update.ts --lockId 1234567 --passcode 9876 --startDate 2024-01-15 --endDate 2024-01-17 --skipDuveUpdate

NOTES:
  - Times are processed in UTC but adjusted for EDT check-in/check-out times
  - If start/end dates don't include time, default check-in (3 PM) and check-out (11 AM) times will be applied
  - The script will show extensive debugging information
  - Always verify the lock profile details before confirming the update
`);
}

// Check if help is requested
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  printUsage();
  process.exit(0);
}

// Run the script
manualLockUpdate();
