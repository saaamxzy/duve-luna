import { db } from "../src/server/db";
import { getConfigWithFallback } from "../src/server/config";

interface LockVersion {
  showAdminKbpwdFlag: boolean;
  groupId: number;
  protocolVersion: number;
  protocolType: number;
  orgId: number;
  logoUrl: string;
  scene: number;
}

interface Lock {
  date: number;
  lockAlias: string;
  keyStatus: string;
  endDate: number;
  groupId: number;
  keyId: number;
  lockMac: string;
  deletePwd: string;
  featureValue: string;
  hasGateway: number;
  wirelessKeypadFeatureValue: string;
  lockName: string;
  keyRight: number;
  specialValue: number;
  keyName: string;
  noKeyPwd: string;
  passageMode: number;
  timezoneRawOffset: number;
  lockId: number;
  electricQuantity: number;
  groupName: string | undefined;
  lockData: string;
  keyboardPwdVersion: number;
  remoteEnable: number;
  lockVersion: LockVersion;
  userType: string;
  startDate: number;
  remarks: string;
}

interface ApiResponse {
  msg: string;
  code: number;
  data: {
    total: number;
    pages: number;
    pageNo: number;
    pageSize: number;
    list: Lock[];
  };
}

// Function to parse lock alias into street number and lock name
function parseLockAlias(lockAlias: string): {
  streetNumber: string;
  lockName: string;
  reason?: string;
} {
  // Extract street number and the rest as lock name
  const match = lockAlias.match(/^(\d+)\s+(.+)$/);

  if (match && match[1] && match[2]) {
    const streetNumber = match[1];
    const lockName = match[2].trim();

    if (!streetNumber) {
      return {
        streetNumber: "",
        lockName: "",
        reason: `Invalid street number in alias: ${lockAlias}`,
      };
    }

    return { streetNumber, lockName };
  }

  // If no format matches, return empty strings with reason
  return {
    streetNumber: "",
    lockName: "",
    reason: `Lock alias format not recognized: ${lockAlias}. Expected format is: "1117 Front Door" or "101 A1"`,
  };
}

async function fetchLocks(page: number): Promise<ApiResponse> {
  // Get configuration values from database with fallback to environment variables
  const sifelyAuthToken = await getConfigWithFallback("SIFELY_AUTH_TOKEN");

  const response = await fetch("https://pro-server.sifely.com/v3/key/list", {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
      Authorization: sifelyAuthToken || "",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: "https://manager.sifely.com",
      Pragma: "no-cache",
      Referer: "https://manager.sifely.com/",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      "sec-ch-ua":
        '"Chromium";v="136", "Google Chrome";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"macOS"',
    },
    body: `keyRight=1&groupId=0&pageNo=${page}&pageSize=10&`,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
}

async function populateLockProfiles() {
  try {
    console.log("Starting to populate lock profiles...");

    let currentPage = 1;
    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalFromAPI = 0;
    let hasMore = true;
    let skippedLocks: Array<{
      lockId: number;
      lockAlias: string;
      reason: string;
    }> = [];

    while (hasMore) {
      console.log(`\nFetching page ${currentPage}...`);
      const response = await fetchLocks(currentPage);

      if (response.code !== 200) {
        throw new Error(`API error: ${response.msg}`);
      }

      const { list, pages, total } = response.data;
      totalFromAPI = total;

      console.log(
        `Page ${currentPage}: Received ${list.length} locks from API`,
      );

      // Process each lock
      for (const lock of list) {
        const { streetNumber, lockName, reason } = parseLockAlias(
          lock.lockAlias,
        );

        if (!streetNumber || !lockName) {
          console.warn(
            `Skipping lock ${lock.lockId} due to invalid alias format: ${lock.lockAlias}`,
          );
          skippedLocks.push({
            lockId: lock.lockId,
            lockAlias: lock.lockAlias,
            reason: reason || "Unknown reason",
          });
          totalSkipped++;
          continue;
        }

        // Create or update LockProfile
        await db.lockProfile.upsert({
          where: {
            streetNumber_lockName: {
              streetNumber,
              lockName,
            },
          },
          create: {
            fullPropertyName: (lock.groupName as string) || "Unknown Property",
            streetNumber,
            lockName,
            lockId: lock.lockId.toString(),
            lockCode: lock.noKeyPwd ? `#${lock.noKeyPwd}` : null,
          },
          update: {
            fullPropertyName: (lock.groupName as string) || "Unknown Property",
            lockId: lock.lockId.toString(),
            lockCode: lock.noKeyPwd ? `#${lock.noKeyPwd}` : null,
          },
        });

        totalProcessed++;
      }

      console.log(`Page ${currentPage}: Processed ${list.length} locks`);

      // Check if there are more pages
      hasMore = currentPage < pages;
      if (hasMore) {
        currentPage++;
      }
    }

    // Print summary
    console.log("\n=== Summary ===");
    console.log(`Total locks from API: ${totalFromAPI}`);
    console.log(`Successfully processed: ${totalProcessed}`);
    console.log(`Skipped locks: ${totalSkipped}`);

    if (skippedLocks.length > 0) {
      console.log("\n=== Skipped Locks Details ===");
      skippedLocks.forEach((lock) => {
        console.log(`Lock ID: ${lock.lockId}`);
        console.log(`Alias: ${lock.lockAlias}`);
        console.log(`Reason: ${lock.reason}`);
        console.log("---");
      });
    }
  } catch (error) {
    console.error("Error populating lock profiles:", error);
  }
}

// Run the script
populateLockProfiles();
