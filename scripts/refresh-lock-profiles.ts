import { refreshLockProfileData } from "../src/server/lockProfileManager";
import { db } from "../src/server/db";

async function main() {
  try {
    console.log("=== Manual Lock Profile Refresh ===");
    await refreshLockProfileData();
    console.log("=== Lock Profile Refresh Complete ===");
  } catch (error) {
    console.error("Error refreshing lock profiles:", error);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
}

// Run the script
main();
