import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { db } from "../src/server/db";
import { updateLockCode } from "../src/server/cron/daily";
import type {
  FailedLockUpdate,
  LockUpdateResult,
} from "../src/server/cron/daily";

interface RetryResult {
  success: boolean;
  reservationId: string;
  lockId: string;
  fullAddress: string;
  guestName: string;
  error?: string;
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

async function retryFailedLocks(): Promise<void> {
  try {
    // First try to read from database
    const failedLocks = await db.failedLockUpdate.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    let retryResults: RetryResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    if (failedLocks.length > 0) {
      console.log(
        `Found ${failedLocks.length} failed lock updates to retry...`,
      );

      // Process each failed lock from database
      for (const failedLock of failedLocks) {
        console.log(
          `\nRetrying lock update for: ${failedLock.fullAddress} - ${failedLock.guestName}`,
        );
        console.log(
          `Lock ID: ${failedLock.lockId}, Reservation ID: ${failedLock.reservationId}`,
        );

        try {
          // Skip locks with unknown lockId
          if (failedLock.lockId === "unknown") {
            console.log("Skipping - unknown lockId");
            retryResults.push({
              success: false,
              reservationId: failedLock.reservationId,
              lockId: failedLock.lockId,
              fullAddress: failedLock.fullAddress,
              guestName: failedLock.guestName,
              error: "Unknown lockId - cannot retry",
            });
            failureCount++;
            continue;
          }

          // Retry the lock code update
          const result = await updateLockCode(
            failedLock.lockId,
            Math.floor(1000 + Math.random() * 9000).toString(), // Generate new code
            failedLock.startDate,
            failedLock.endDate,
            failedLock.duveId,
          );

          if (result.success) {
            console.log("✅ Successfully retried lock code update");
            retryResults.push({
              success: true,
              reservationId: failedLock.reservationId,
              lockId: failedLock.lockId,
              fullAddress: failedLock.fullAddress,
              guestName: failedLock.guestName,
            });
            successCount++;

            // Remove the successfully retried lock from the database
            await db.failedLockUpdate.delete({
              where: { id: failedLock.id },
            });
          } else {
            console.log("❌ Failed to retry lock code update");
            const errorMessage = result.errorDetails?.message || "Retry failed";
            console.log(`   Error: ${errorMessage}`);
            retryResults.push({
              success: false,
              reservationId: failedLock.reservationId,
              lockId: failedLock.lockId,
              fullAddress: failedLock.fullAddress,
              guestName: failedLock.guestName,
              error: errorMessage,
              errorDetails: result.errorDetails,
            });
            failureCount++;
          }
        } catch (error) {
          console.log(
            `❌ Error during retry: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          retryResults.push({
            success: false,
            reservationId: failedLock.reservationId,
            lockId: failedLock.lockId,
            fullAddress: failedLock.fullAddress,
            guestName: failedLock.guestName,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          failureCount++;
        }
      }
    } else {
      // Fallback to file system if database is empty (for backward compatibility)
      const logsDir = join(process.cwd(), "logs");
      const failedLocksFile = join(logsDir, "failed-lock-updates.json");
      const retryResultsFile = join(logsDir, "retry-results.json");

      if (!existsSync(failedLocksFile)) {
        console.log("No failed locks found. Nothing to retry.");
        return;
      }

      // Read failed locks from file
      const fileContent = readFileSync(failedLocksFile, "utf8");
      const failedLocksFromFile: FailedLockUpdate[] = JSON.parse(fileContent);

      if (failedLocksFromFile.length === 0) {
        console.log("No failed locks to retry.");
        return;
      }

      console.log(
        `Found ${failedLocksFromFile.length} failed lock updates to retry...`,
      );

      // Process each failed lock from file
      for (const failedLock of failedLocksFromFile) {
        console.log(
          `\nRetrying lock update for: ${failedLock.fullAddress} - ${failedLock.guestName}`,
        );
        console.log(
          `Lock ID: ${failedLock.lockId}, Reservation ID: ${failedLock.reservationId}`,
        );

        try {
          // Skip locks with unknown lockId
          if (failedLock.lockId === "unknown") {
            console.log("Skipping - unknown lockId");
            retryResults.push({
              success: false,
              reservationId: failedLock.reservationId,
              lockId: failedLock.lockId,
              fullAddress: failedLock.fullAddress,
              guestName: failedLock.guestName,
              error: "Unknown lockId - cannot retry",
            });
            failureCount++;
            continue;
          }

          // Retry the lock code update
          const result = await updateLockCode(
            failedLock.lockId,
            Math.floor(1000 + Math.random() * 9000).toString(), // Generate new code
            new Date(failedLock.startDate),
            new Date(failedLock.endDate),
            failedLock.duveId,
          );

          if (result.success) {
            console.log("✅ Successfully retried lock code update");
            retryResults.push({
              success: true,
              reservationId: failedLock.reservationId,
              lockId: failedLock.lockId,
              fullAddress: failedLock.fullAddress,
              guestName: failedLock.guestName,
            });
            successCount++;
          } else {
            console.log("❌ Failed to retry lock code update");
            const errorMessage = result.errorDetails?.message || "Retry failed";
            console.log(`   Error: ${errorMessage}`);
            retryResults.push({
              success: false,
              reservationId: failedLock.reservationId,
              lockId: failedLock.lockId,
              fullAddress: failedLock.fullAddress,
              guestName: failedLock.guestName,
              error: errorMessage,
              errorDetails: result.errorDetails,
            });
            failureCount++;
          }
        } catch (error) {
          console.log(
            `❌ Error during retry: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          retryResults.push({
            success: false,
            reservationId: failedLock.reservationId,
            lockId: failedLock.lockId,
            fullAddress: failedLock.fullAddress,
            guestName: failedLock.guestName,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          failureCount++;
        }
      }

      // Save retry results to file
      writeFileSync(retryResultsFile, JSON.stringify(retryResults, null, 2));

      // Remove successfully retried locks from the failed locks file
      const stillFailedLocks = failedLocksFromFile.filter(
        (_, index) => !retryResults[index]?.success,
      );
      writeFileSync(failedLocksFile, JSON.stringify(stillFailedLocks, null, 2));
      console.log(
        `Updated failed locks file - ${stillFailedLocks.length} locks still failed`,
      );
    }

    // Summary
    console.log(`\n=== Retry Summary ===`);
    console.log(
      `Total attempted: ${failedLocks.length || retryResults.length}`,
    );
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failureCount}`);

    if (failedLocks.length > 0) {
      console.log(`Database updated - ${failureCount} locks still failed`);
    }
  } catch (error) {
    console.error("Error during retry process:", error);
  } finally {
    await db.$disconnect();
  }
}

// Run the retry function
(async () => {
  await retryFailedLocks();
  process.exit(0);
})();
