import { db } from "../src/server/db";

async function clearLockProfiles() {
  try {
    console.log("Starting to clear lock profiles...");
    
    const result = await db.lockProfile.deleteMany({});
    
    console.log(`Successfully deleted ${result.count} lock profiles`);
  } catch (error) {
    console.error("Error clearing lock profiles:", error);
  } finally {
    await db.$disconnect();
  }
}

// Run the script
clearLockProfiles(); 