import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "../../../server/db";
import { dailyTask, updateLockCode } from "../../../server/cron/daily";

// GET /api/daily-task - Get daily task statistics and recent runs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "10");

    // Get recent daily task runs
    const recentRuns = await db.dailyTaskRun.findMany({
      take: limit,
      orderBy: { startTime: "desc" },
      include: {
        failedLockUpdates: {
          where: { retrySuccessful: false },
          select: {
            id: true,
            lockId: true,
            propertyName: true,
            fullAddress: true,
            guestName: true,
            error: true,
            errorType: true,
            retryCount: true,
            lastRetryAt: true,
          },
        },
      },
    });

    // Get current running task if any
    const runningTask = await db.dailyTaskRun.findFirst({
      where: { status: "running" },
      orderBy: { startTime: "desc" },
    });

    // Get overall statistics
    const totalRuns = await db.dailyTaskRun.count();
    const totalFailedUpdates = await db.failedLockUpdate.count({
      where: { retrySuccessful: false },
    });

    return NextResponse.json({
      success: true,
      data: {
        recentRuns,
        runningTask,
        statistics: {
          totalRuns,
          totalFailedUpdates,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching daily task data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch daily task data" },
      { status: 500 },
    );
  }
}

// POST /api/daily-task - Trigger daily task manually
export async function POST(request: NextRequest) {
  try {
    const { action } = (await request.json()) as { action: string };

    if (action === "trigger") {
      // Check if there's already a running task
      const runningTask = await db.dailyTaskRun.findFirst({
        where: { status: "running" },
      });

      if (runningTask) {
        return NextResponse.json(
          { success: false, error: "A daily task is already running" },
          { status: 400 },
        );
      }

      // Trigger the daily task in the background
      void dailyTask();

      return NextResponse.json({
        success: true,
        message: "Daily task triggered successfully",
      });
    }

    if (action === "retry-failed") {
      const { failedUpdateIds } = (await request.json()) as {
        failedUpdateIds: string[];
      };

      if (!Array.isArray(failedUpdateIds) || failedUpdateIds.length === 0) {
        return NextResponse.json(
          { success: false, error: "No failed update IDs provided" },
          { status: 400 },
        );
      }

      // Get the failed lock updates to retry
      const failedUpdates = await db.failedLockUpdate.findMany({
        where: {
          id: { in: failedUpdateIds },
          retrySuccessful: false,
        },
      });

      if (failedUpdates.length === 0) {
        return NextResponse.json(
          { success: false, error: "No valid failed updates found" },
          { status: 404 },
        );
      }

      const retryResults = [];
      let successCount = 0;
      let failureCount = 0;

      // Process each failed update
      for (const failedUpdate of failedUpdates) {
        try {
          // Skip locks with unknown lockId
          if (failedUpdate.lockId === "unknown") {
            retryResults.push({
              id: failedUpdate.id,
              success: false,
              error: "Unknown lockId - cannot retry",
            });
            failureCount++;
            continue;
          }

          // Retry the lock code update
          const result = await updateLockCode(
            failedUpdate.lockId,
            Math.floor(1000 + Math.random() * 9000).toString(), // Generate new code
            failedUpdate.startDate,
            failedUpdate.endDate,
            failedUpdate.duveId,
          );

          if (result.success) {
            // Update the database record
            await db.failedLockUpdate.update({
              where: { id: failedUpdate.id },
              data: {
                retrySuccessful: true,
                retryCount: { increment: 1 },
                lastRetryAt: new Date(),
              },
            });

            retryResults.push({
              id: failedUpdate.id,
              success: true,
            });
            successCount++;
          } else {
            // Update retry count and last retry time
            await db.failedLockUpdate.update({
              where: { id: failedUpdate.id },
              data: {
                retryCount: { increment: 1 },
                lastRetryAt: new Date(),
              },
            });

            retryResults.push({
              id: failedUpdate.id,
              success: false,
              error: result.errorDetails?.message ?? "Retry failed",
            });
            failureCount++;
          }
        } catch (error) {
          retryResults.push({
            id: failedUpdate.id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          failureCount++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Retry completed: ${successCount} successful, ${failureCount} failed`,
        data: {
          retryResults,
          successCount,
          failureCount,
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Invalid action" },
      { status: 400 },
    );
  } catch (error) {
    console.error("Error in daily task POST:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
