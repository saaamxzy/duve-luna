import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { db } from "../src/server/db";
import type { FailedLockUpdate } from "../src/server/cron/daily";

async function viewFailedLocks(): Promise<void> {
  try {
    // First try to read from database
    const failedLocks = await db.failedLockUpdate.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    if (failedLocks.length > 0) {
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
          `   Dates: ${failedLock.startDate.toLocaleDateString()} - ${failedLock.endDate.toLocaleDateString()}`,
        );
        console.log(`   Error: ${failedLock.error}`);
        console.log(`   Failed at: ${failedLock.createdAt.toLocaleString()}`);
        console.log("");
      });

      console.log(
        `💡 To retry these failed locks, run: npx tsx scripts/retry-failed-locks.ts`,
      );
      return;
    }

    // Fallback to file system if database is empty (for backward compatibility)
    const logsDir = join(process.cwd(), "logs");
    const failedLocksFile = join(logsDir, "failed-lock-updates.json");

    if (!existsSync(failedLocksFile)) {
      console.log("No failed locks found.");
      return;
    }

    // Read failed locks from file
    const fileContent = readFileSync(failedLocksFile, "utf8");
    const failedLocksFromFile: FailedLockUpdate[] = JSON.parse(fileContent);

    if (failedLocksFromFile.length === 0) {
      console.log("No failed locks found.");
      return;
    }

    console.log(
      `\n=== Failed Lock Updates (${failedLocksFromFile.length} total) ===\n`,
    );

    // Display each failed lock
    failedLocksFromFile.forEach((failedLock, index) => {
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
    console.error("Error reading failed locks:", error);
  } finally {
    await db.$disconnect();
  }
}

// Run the view function
viewFailedLocks();
