import { db } from "./db";
import { getConfigWithFallback } from "./config";

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

interface LockApiResponse {
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

interface KeyboardPassword {
  endDate: number;
  sendDate: number;
  keyboardPwdId: number;
  nickName: string;
  keyboardPwdType: number;
  lockId: number;
  keyboardPwdVersion: number;
  isCustom: number;
  keyboardPwdName: string;
  keyboardPwd: string;
  startDate: number;
  senderUsername: string;
  receiverUsername: string;
  status: number;
}

interface KeyboardPasswordApiResponse {
  msg: string;
  code: number;
  data: {
    list: KeyboardPassword[];
    pageNo: number;
    pageSize: number;
    pages: number;
    total: number;
  };
}

// Function to parse lock alias into street number and lock name
function parseLockAlias(lockAlias: string): {
  streetNumber: string;
  lockName: string;
  reason?: string;
} {
  // Extract street number and the rest as lock name
  const match = /^(\d+)\s+(.+)$/.exec(lockAlias);

  if (match?.[1] && match?.[2]) {
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

// Function to fetch locks from the API
async function fetchLocks(page: number): Promise<LockApiResponse> {
  const sifelyAuthToken = await getConfigWithFallback("SIFELY_AUTH_TOKEN");

  const response = await fetch("https://pro-server.sifely.com/v3/key/list", {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
      Authorization: sifelyAuthToken ?? "",
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

  return response.json() as Promise<LockApiResponse>;
}

// Function to fetch keyboard passwords from the API
async function fetchKeyboardPasswords(
  lockId: string,
  page: number,
): Promise<KeyboardPasswordApiResponse> {
  const sifelyAuthToken = await getConfigWithFallback("SIFELY_AUTH_TOKEN");

  const response = await fetch(
    "https://pro-server.sifely.com/v3/lock/listKeyboardPwd",
    {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        Authorization: sifelyAuthToken ?? "",
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
      body: new URLSearchParams({
        lockId,
        pageNo: page.toString(),
        pageSize: "10",
        orderBy: "1",
        date: Date.now().toString(),
      }).toString(),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json() as Promise<KeyboardPasswordApiResponse>;
}

// Function to clear lock profiles and keyboard passwords
export async function clearLockProfiles(): Promise<void> {
  console.log(
    "[LockProfileManager] Starting to clear lock profiles and keyboard passwords...",
  );

  try {
    // First delete keyboard passwords to maintain referential integrity
    const keyboardResult = await db.keyboardPassword.deleteMany({});
    console.log(
      `[LockProfileManager] Successfully deleted ${keyboardResult.count} keyboard passwords`,
    );

    // Then delete lock profiles
    const lockResult = await db.lockProfile.deleteMany({});
    console.log(
      `[LockProfileManager] Successfully deleted ${lockResult.count} lock profiles`,
    );

    console.log("[LockProfileManager] Cleanup completed successfully");
  } catch (error) {
    console.error("[LockProfileManager] Error during cleanup:", error);
    throw error;
  }
}

// Function to populate lock profiles
export async function populateLockProfiles(): Promise<void> {
  console.log("[LockProfileManager] Starting to populate lock profiles...");

  try {
    let currentPage = 1;
    let totalProcessed = 0;
    let totalSkipped = 0;
    let totalFromAPI = 0;
    let hasMore = true;
    const skippedLocks: Array<{
      lockId: number;
      lockAlias: string;
      reason: string;
    }> = [];

    while (hasMore) {
      console.log(`[LockProfileManager] Fetching page ${currentPage}...`);
      const response = await fetchLocks(currentPage);

      if (response.code !== 200) {
        throw new Error(`API error: ${response.msg}`);
      }

      const { list, pages, total } = response.data;
      totalFromAPI = total;

      console.log(
        `[LockProfileManager] Page ${currentPage}: Received ${list.length} locks from API`,
      );

      // Process each lock
      for (const lock of list) {
        const { streetNumber, lockName, reason } = parseLockAlias(
          lock.lockAlias,
        );

        if (!streetNumber || !lockName) {
          console.warn(
            `[LockProfileManager] Skipping lock ${lock.lockId} due to invalid alias format: ${lock.lockAlias}`,
          );
          skippedLocks.push({
            lockId: lock.lockId,
            lockAlias: lock.lockAlias,
            reason: reason ?? "Unknown reason",
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
            fullPropertyName: lock.groupName ?? "Unknown Property",
            streetNumber,
            lockName,
            lockId: lock.lockId.toString(),
            lockCode: lock.noKeyPwd ? `#${lock.noKeyPwd}` : null,
          },
          update: {
            fullPropertyName: lock.groupName ?? "Unknown Property",
            lockId: lock.lockId.toString(),
            lockCode: lock.noKeyPwd ? `#${lock.noKeyPwd}` : null,
          },
        });

        totalProcessed++;
      }

      console.log(
        `[LockProfileManager] Page ${currentPage}: Processed ${list.length} locks`,
      );

      // Check if there are more pages
      hasMore = currentPage < pages;
      if (hasMore) {
        currentPage++;
      }
    }

    // Print summary
    console.log("[LockProfileManager] === Lock Profiles Summary ===");
    console.log(`[LockProfileManager] Total locks from API: ${totalFromAPI}`);
    console.log(
      `[LockProfileManager] Successfully processed: ${totalProcessed}`,
    );
    console.log(`[LockProfileManager] Skipped locks: ${totalSkipped}`);

    if (skippedLocks.length > 0) {
      console.log("[LockProfileManager] === Skipped Locks Details ===");
      skippedLocks.forEach((lock) => {
        console.log(`[LockProfileManager] Lock ID: ${lock.lockId}`);
        console.log(`[LockProfileManager] Alias: ${lock.lockAlias}`);
        console.log(`[LockProfileManager] Reason: ${lock.reason}`);
        console.log("[LockProfileManager] ---");
      });
    }
  } catch (error) {
    console.error(
      "[LockProfileManager] Error populating lock profiles:",
      error,
    );
    throw error;
  }
}

// Function to populate keyboard passwords
export async function populateKeyboardPasswords(): Promise<void> {
  console.log(
    "[LockProfileManager] Starting to populate keyboard passwords...",
  );

  try {
    // Get all LockProfiles that have a lockId
    const lockProfiles = await db.lockProfile.findMany({
      where: {
        lockId: { not: null },
      },
    });

    console.log(
      `[LockProfileManager] Found ${lockProfiles.length} lock profiles with lockId`,
    );

    for (const lockProfile of lockProfiles) {
      if (!lockProfile.lockId) continue;

      console.log(
        `[LockProfileManager] Processing lock profile ${lockProfile.id} (lockId: ${lockProfile.lockId})...`,
      );

      let currentPage = 1;
      let hasMore = true;
      let totalProcessed = 0;

      while (hasMore) {
        const response = await fetchKeyboardPasswords(
          lockProfile.lockId,
          currentPage,
        );

        if (response.code !== 200) {
          console.error(
            `[LockProfileManager] API error for lockId ${lockProfile.lockId}: ${response.msg}`,
          );
          break;
        }

        const { list, pages } = response.data;

        // Process each keyboard password
        for (const password of list) {
          try {
            await db.keyboardPassword.upsert({
              where: {
                keyboardPwdId: password.keyboardPwdId,
              },
              create: {
                keyboardPwdId: password.keyboardPwdId,
                keyboardPwdName: password.keyboardPwdName,
                keyboardPwd: password.keyboardPwd,
                keyboardPwdType: password.keyboardPwdType,
                keyboardPwdVersion: password.keyboardPwdVersion,
                startDate: password.startDate
                  ? new Date(password.startDate)
                  : null,
                endDate: password.endDate ? new Date(password.endDate) : null,
                sendDate: new Date(password.sendDate),
                status: password.status,
                isCustom: password.isCustom === 1,
                nickName: password.nickName,
                senderUsername: password.senderUsername,
                receiverUsername: password.receiverUsername ?? null,
                lockProfileId: lockProfile.id,
              },
              update: {
                keyboardPwdName: password.keyboardPwdName,
                keyboardPwd: password.keyboardPwd,
                keyboardPwdType: password.keyboardPwdType,
                keyboardPwdVersion: password.keyboardPwdVersion,
                startDate: password.startDate
                  ? new Date(password.startDate)
                  : null,
                endDate: password.endDate ? new Date(password.endDate) : null,
                sendDate: new Date(password.sendDate),
                status: password.status,
                isCustom: password.isCustom === 1,
                nickName: password.nickName,
                senderUsername: password.senderUsername,
                receiverUsername: password.receiverUsername ?? null,
              },
            });

            totalProcessed++;
          } catch (error) {
            console.error(
              `[LockProfileManager] Error processing keyboard password ${password.keyboardPwdId}:`,
              error,
            );
          }
        }

        console.log(
          `[LockProfileManager] Page ${currentPage}: Processed ${list.length} keyboard passwords`,
        );

        // Check if there are more pages
        hasMore = currentPage < pages;
        if (hasMore) {
          currentPage++;
        }
      }

      console.log(
        `[LockProfileManager] Completed processing lock profile ${lockProfile.id}. Total passwords processed: ${totalProcessed}`,
      );
    }

    console.log("[LockProfileManager] === Keyboard Passwords Summary ===");
    console.log(
      `[LockProfileManager] Successfully processed keyboard passwords for ${lockProfiles.length} lock profiles`,
    );
  } catch (error) {
    console.error(
      "[LockProfileManager] Error populating keyboard passwords:",
      error,
    );
    throw error;
  }
}

// Main function to refresh all lock profile data
export async function refreshLockProfileData(): Promise<void> {
  console.log(
    "[LockProfileManager] Starting complete lock profile data refresh...",
  );

  try {
    await clearLockProfiles();
    await populateLockProfiles();
    await populateKeyboardPasswords();
    console.log(
      "[LockProfileManager] Complete lock profile data refresh completed successfully",
    );
  } catch (error) {
    console.error(
      "[LockProfileManager] Error during lock profile data refresh:",
      error,
    );
    throw error;
  }
}
