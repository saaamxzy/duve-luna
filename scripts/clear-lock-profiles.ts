import { db } from "../src/server/db";

async function clearLockProfiles() {
  try {
    console.log("Starting to clear lock profiles and keyboard passwords...");
    
    // First delete keyboard passwords to maintain referential integrity
    const keyboardResult = await db.keyboardPassword.deleteMany({});
    console.log(`Successfully deleted ${keyboardResult.count} keyboard passwords`);
    
    // Then delete lock profiles
    const lockResult = await db.lockProfile.deleteMany({});
    console.log(`Successfully deleted ${lockResult.count} lock profiles`);
    
    console.log("Cleanup completed successfully");
  } catch (error) {
    console.error("Error during cleanup:", error);
  } finally {
    await db.$disconnect();
  }
}

// Run the script
clearLockProfiles(); 