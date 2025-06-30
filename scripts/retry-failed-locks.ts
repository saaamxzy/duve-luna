import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { updateLockCode } from "../src/server/cron/daily";
import type { FailedLockUpdate } from "../src/server/cron/daily";

interface RetryResult {
  success: boolean;
  reservationId: string;
  lockId: string;
  fullAddress: string;
  guestName: string;
  error?: string;
}

async function retryFailedLocks(): Promise<void> {
  const logsDir = join(process.cwd(), "logs");
  const failedLocksFile = join(logsDir, "failed-lock-updates.json");
  const retryResultsFile = join(logsDir, "retry-results.json");

  // Check if failed locks file exists
  if (!existsSync(failedLocksFile)) {
    console.log("No failed locks file found. Nothing to retry.");
    return;
  }

  try {
    // Read failed locks
    const fileContent = readFileSync(failedLocksFile, "utf8");
    const failedLocks: FailedLockUpdate[] = JSON.parse(fileContent);

    if (failedLocks.length === 0) {
      console.log("No failed locks to retry.");
      return;
    }

    console.log(`Found ${failedLocks.length} failed lock updates to retry...`);

    const retryResults: RetryResult[] = [];
    let successCount = 0;
    let failureCount = 0;

    // Process each failed lock
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
        const success = await updateLockCode(
          failedLock.lockId,
          Math.floor(1000 + Math.random() * 9000).toString(), // Generate new code
          new Date(failedLock.startDate),
          new Date(failedLock.endDate),
          failedLock.duveId,
        );

        if (success) {
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
          retryResults.push({
            success: false,
            reservationId: failedLock.reservationId,
            lockId: failedLock.lockId,
            fullAddress: failedLock.fullAddress,
            guestName: failedLock.guestName,
            error: "Retry failed",
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

    // Save retry results
    writeFileSync(retryResultsFile, JSON.stringify(retryResults, null, 2));

    // Summary
    console.log(`\n=== Retry Summary ===`);
    console.log(`Total attempted: ${failedLocks.length}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Failed: ${failureCount}`);
    console.log(`Results saved to: ${retryResultsFile}`);

    // Optionally, remove successfully retried locks from the failed locks file
    const stillFailedLocks = failedLocks.filter(
      (_, index) => !retryResults[index]?.success,
    );
    writeFileSync(failedLocksFile, JSON.stringify(stillFailedLocks, null, 2));
    console.log(
      `Updated failed locks file - ${stillFailedLocks.length} locks still failed`,
    );
  } catch (error) {
    console.error("Error reading failed locks file:", error);
  }
}

// Run the retry function
(async () => {
  await retryFailedLocks();
  process.exit(0);
})();
