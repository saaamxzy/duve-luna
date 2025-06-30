import { readFileSync, existsSync } from "fs";
import { join } from "path";
import type { FailedLockUpdate } from "../src/server/cron/daily";

function viewFailedLocks(): void {
  const logsDir = join(process.cwd(), "logs");
  const failedLocksFile = join(logsDir, "failed-lock-updates.json");

  // Check if failed locks file exists
  if (!existsSync(failedLocksFile)) {
    console.log("No failed locks file found.");
    return;
  }

  try {
    // Read failed locks
    const fileContent = readFileSync(failedLocksFile, "utf8");
    const failedLocks: FailedLockUpdate[] = JSON.parse(fileContent);

    if (failedLocks.length === 0) {
      console.log("No failed locks found.");
      return;
    }

    console.log(
      `\n=== Failed Lock Updates (${failedLocks.length} total) ===\n`,
    );

    // Display each failed lock
    failedLocks.forEach((failedLock, index) => {
      console.log(
        `${index + 1}. ${failedLock.fullAddress} - ${failedLock.guestName}`,
      );
      console.log(`   Reservation ID: ${failedLock.reservationId}`);
      console.log(`   Lock ID: ${failedLock.lockId}`);
      console.log(`   Duve ID: ${failedLock.duveId}`);
      console.log(
        `   Dates: ${new Date(failedLock.startDate).toLocaleDateString()} - ${new Date(failedLock.endDate).toLocaleDateString()}`,
      );
      console.log(`   Error: ${failedLock.error}`);
      console.log(
        `   Failed at: ${new Date(failedLock.timestamp).toLocaleString()}`,
      );
      console.log("");
    });

    console.log(
      `💡 To retry these failed locks, run: npx tsx scripts/retry-failed-locks.ts`,
    );
  } catch (error) {
    console.error("Error reading failed locks file:", error);
  }
}

// Run the view function
viewFailedLocks();
