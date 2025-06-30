import { db } from "../src/server/db";

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

interface ApiResponse {
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

async function fetchKeyboardPasswords(
  lockId: string,
  page: number,
): Promise<ApiResponse> {
  const response = await fetch(
    "https://pro-server.sifely.com/v3/lock/listKeyboardPwd",
    {
      method: "POST",
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
        Authorization: process.env.SIFELY_AUTH_TOKEN as string,
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

  return response.json();
}

async function populateKeyboardPasswords() {
  try {
    console.log("Starting to populate keyboard passwords...");

    // Get all LockProfiles that have a lockId
    const lockProfiles = await db.lockProfile.findMany({
      where: {
        lockId: { not: null },
      },
    });

    console.log(`Found ${lockProfiles.length} lock profiles with lockId`);

    for (const lockProfile of lockProfiles) {
      if (!lockProfile.lockId) continue;

      console.log(
        `\nProcessing lock profile ${lockProfile.id} (lockId: ${lockProfile.lockId})...`,
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
            `API error for lockId ${lockProfile.lockId}: ${response.msg}`,
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
                receiverUsername: password.receiverUsername || null,
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
                receiverUsername: password.receiverUsername || null,
              },
            });

            totalProcessed++;
          } catch (error) {
            console.error(
              `Error processing keyboard password ${password.keyboardPwdId}:`,
              error,
            );
          }
        }

        console.log(
          `Page ${currentPage}: Processed ${list.length} keyboard passwords`,
        );

        // Check if there are more pages
        hasMore = currentPage < pages;
        if (hasMore) {
          currentPage++;
        }
      }

      console.log(
        `Completed processing lock profile ${lockProfile.id}. Total passwords processed: ${totalProcessed}`,
      );
    }

    console.log("\n=== Summary ===");
    console.log(
      `Successfully processed keyboard passwords for ${lockProfiles.length} lock profiles`,
    );
  } catch (error) {
    console.error("Error populating keyboard passwords:", error);
  } finally {
    await db.$disconnect();
  }
}

// Run the script
populateKeyboardPasswords();
