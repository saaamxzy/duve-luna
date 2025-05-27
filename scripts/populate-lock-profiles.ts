import { db } from "../src/server/db";

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

// Function to parse lock alias into street number and room number
function parseLockAlias(lockAlias: string): {
  streetNumber: string;
  roomNumber: string;
} {
  // Try different formats
  const formats = [
    // Format: "1117 #A1"
    /^(\d+)\s+#([A-Za-z0-9]+)$/,
    // Format: "101 - Sartain"
    /^(\d+)\s+-\s+[A-Za-z]+$/,
    // Format: "101 Sartain"
    /^(\d+)\s+[A-Za-z]+$/,
  ];

  for (const format of formats) {
    const match = lockAlias.match(format);
    if (match) {
      const streetNumber = match[1];
      if (!streetNumber) {
        console.warn(`Could not parse lock alias: ${lockAlias}`);
        return { streetNumber: "", roomNumber: "" };
      }
      // For formats without room number, use the street number as room number
      const roomNumber = match[2] ? `#${match[2]}` : `#${streetNumber}`;
      return { streetNumber, roomNumber };
    }
  }

  // If no format matches, return empty strings
  console.warn(`Could not parse lock alias: ${lockAlias}`);
  return { streetNumber: "", roomNumber: "" };
}

async function fetchLocks(page: number): Promise<ApiResponse> {
  const response = await fetch("https://pro-server.sifely.com/v3/key/list", {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
      Authorization:
        "Bearer eyJhbGciOiJIUzUxMiJ9.eyJjbGllbnRfaWQiOm51bGwsImxvZ2luX3VzZXJfa2V5IjoiYjZmNmRmNTUtMzIzNS00OWEzLWJlOTktMWMzYWM3ZWE2M2Q4In0.xwDxzUE8qt9F1EkoNs4SYOshKIbKTTgTDUc1GIFuQadTQaeTDsNUmE27WygIZFrcN2nQqKrL-0K3mMJMNyx7JA",
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
    let hasMore = true;

    while (hasMore) {
      console.log(`Fetching page ${currentPage}...`);
      const response = await fetchLocks(currentPage);

      if (response.code !== 200) {
        throw new Error(`API error: ${response.msg}`);
      }

      const { list, pages } = response.data;

      // Process each lock
      for (const lock of list) {
        const { streetNumber, roomNumber } = parseLockAlias(lock.lockAlias);

        if (!streetNumber || !roomNumber) {
          console.warn(
            `Skipping lock ${lock.lockId} due to invalid alias format: ${lock.lockAlias}`,
          );
          continue;
        }

        // Create or update LockProfile
        await db.lockProfile.upsert({
          where: {
            streetNumber_roomNumber: {
              streetNumber,
              roomNumber,
            },
          },
          create: {
            fullPropertyName: (lock.groupName as string) || "Unknown Property",
            streetNumber,
            roomNumber,
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

      console.log(`Processed ${list.length} locks from page ${currentPage}`);

      // Check if there are more pages
      hasMore = currentPage < pages;
      if (hasMore) {
        currentPage++;
      }
    }

    console.log(`Successfully processed all ${totalProcessed} locks`);
  } catch (error) {
    console.error("Error populating lock profiles:", error);
  }
}

// Run the script
populateLockProfiles();
