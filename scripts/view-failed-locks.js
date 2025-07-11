"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var path_1 = require("path");
function viewFailedLocks() {
  var logsDir = (0, path_1.join)(process.cwd(), "logs");
  var failedLocksFile = (0, path_1.join)(logsDir, "failed-lock-updates.json");
  // Check if failed locks file exists
  if (!(0, fs_1.existsSync)(failedLocksFile)) {
    console.log("No failed locks file found.");
    return;
  }
  try {
    // Read failed locks
    var fileContent = (0, fs_1.readFileSync)(failedLocksFile, "utf8");
    var failedLocks = JSON.parse(fileContent);
    if (failedLocks.length === 0) {
      console.log("No failed locks found.");
      return;
    }
    console.log(
      "\n=== Failed Lock Updates (".concat(failedLocks.length, " total) ===\n"),
    );
    // Display each failed lock
    failedLocks.forEach(function (failedLock, index) {
      console.log(
        ""
          .concat(index + 1, ". ")
          .concat(failedLock.fullAddress, " - ")
          .concat(failedLock.guestName),
      );
      console.log("   Reservation ID: ".concat(failedLock.reservationId));
      console.log("   Lock ID: ".concat(failedLock.lockId));
      console.log("   Duve ID: ".concat(failedLock.duveId));
      console.log(
        "   Dates: "
          .concat(new Date(failedLock.startDate).toLocaleDateString(), " - ")
          .concat(new Date(failedLock.endDate).toLocaleDateString()),
      );
      console.log("   Error: ".concat(failedLock.error));
      console.log(
        "   Failed at: ".concat(
          new Date(failedLock.timestamp).toLocaleString(),
        ),
      );
      console.log("");
    });
    console.log(
      "\uD83D\uDCA1 To retry these failed locks, run: npx tsx scripts/retry-failed-locks.ts",
    );
  } catch (error) {
    console.error("Error reading failed locks file:", error);
  }
}
// Run the view function
viewFailedLocks();
