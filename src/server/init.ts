import { startDailyCron } from "./cron/daily";

// Initialize server-side features
export function initializeServer() {
  // Start the daily cron job
  startDailyCron();

  console.log("Server initialized");
}
