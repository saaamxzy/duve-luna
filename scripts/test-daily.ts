import { dailyTask } from "../src/server/cron/daily";

(async () => {
  await dailyTask();
  process.exit(0);
})();
