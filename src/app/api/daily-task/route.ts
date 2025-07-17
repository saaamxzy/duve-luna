import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "../../../server/db";
import {
  dailyTask,
  updateLockCode,
  prepDailyTask,
  executeLockCodeUpdates,
} from "../../../server/cron/daily";

// GET /api/daily-task - Get daily task statistics and recent runs
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "10");
    const runId = searchParams.get("runId");
    const prepRunId = searchParams.get("prepRunId");

    // If prepRunId is provided, return prep reservations for that run
    if (prepRunId) {
      const prepReservations = await db.prepReservation.findMany({
        where: { dailyTaskRunId: prepRunId },
        orderBy: { createdAt: "asc" },
      });

      const prepRun = await db.dailyTaskRun.findUnique({
        where: { id: prepRunId },
      });

      if (!prepRun) {
        return NextResponse.json(
          { success: false, error: "Prep run not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          prepRun,
          prepReservations,
        },
      });
    }

    // If runId is provided, return detailed information about that specific run
    if (runId) {
      const run = await db.dailyTaskRun.findUnique({
        where: { id: runId },
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
              startDate: true,
              endDate: true,
              duveId: true,
              reservationId: true,
            },
          },
          successfulLockUpdates: {
            select: {
              id: true,
              lockId: true,
              propertyName: true,
              fullAddress: true,
              guestName: true,
              lockCode: true,
              lockCodeStart: true,
              lockCodeEnd: true,
              processingTime: true,
              startDate: true,
              endDate: true,
              duveId: true,
              reservationId: true,
            },
          },
        },
      });

      if (!run) {
        return NextResponse.json(
          { success: false, error: "Run not found" },
          { status: 404 },
        );
      }

      return NextResponse.json({
        success: true,
        data: { run },
      });
    }

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
        successfulLockUpdates: {
          select: {
            id: true,
            lockId: true,
            propertyName: true,
            fullAddress: true,
            guestName: true,
            lockCode: true,
            lockCodeStart: true,
            lockCodeEnd: true,
            processingTime: true,
            startDate: true,
            endDate: true,
            duveId: true,
            reservationId: true,
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
    const body = (await request.json()) as {
      action: string;
      taskId?: string;
      failedUpdateIds?: string[];
      prepRunId?: string;
      prepReservationIds?: string[];
      selectedPrepReservations?: { id: string; isSelected: boolean }[];
    };
    const { action, taskId } = body;

    if (action === "kill") {
      // Kill a running task
      if (!taskId) {
        return NextResponse.json(
          { success: false, error: "Task ID is required" },
          { status: 400 },
        );
      }

      // Find the running task
      const runningTask = await db.dailyTaskRun.findUnique({
        where: { id: taskId },
      });

      if (!runningTask) {
        return NextResponse.json(
          { success: false, error: "Task not found" },
          { status: 404 },
        );
      }

      if (runningTask.status !== "running") {
        return NextResponse.json(
          { success: false, error: "Task is not running" },
          { status: 400 },
        );
      }

      // Kill the task
      const endTime = new Date();
      const duration = endTime.getTime() - runningTask.startTime.getTime();

      await db.dailyTaskRun.update({
        where: { id: taskId },
        data: {
          endTime,
          duration,
          status: "killed",
          error: "Task was manually killed by user",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Task killed successfully",
      });
    }

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
      const { failedUpdateIds } = body;

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
      const createdSuccessfulUpdates = [];
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

          // Generate new lock code
          const lockCode = Math.floor(1000 + Math.random() * 9000).toString();
          
          // Retry the lock code update
          const startTime = Date.now();
          const result = await updateLockCode(
            failedUpdate.lockId,
            lockCode,
            failedUpdate.startDate,
            failedUpdate.endDate,
            failedUpdate.duveId,
          );
          const processingTime = Date.now() - startTime;

          if (result.success) {
            // Create a successful lock update record
            const successfulUpdate = await db.successfulLockUpdate.create({
              data: {
                dailyTaskRunId: failedUpdate.dailyTaskRunId,
                reservationId: failedUpdate.reservationId,
                duveId: failedUpdate.duveId,
                lockId: failedUpdate.lockId,
                propertyName: failedUpdate.propertyName,
                fullAddress: failedUpdate.fullAddress,
                guestName: failedUpdate.guestName,
                startDate: failedUpdate.startDate,
                endDate: failedUpdate.endDate,
                lockCode: lockCode,
                lockCodeStart: failedUpdate.startDate,
                lockCodeEnd: failedUpdate.endDate,
                processingTime: processingTime,
              },
            });

            // Mark the failed update as successful
            await db.failedLockUpdate.update({
              where: { id: failedUpdate.id },
              data: {
                retrySuccessful: true,
                retryCount: { increment: 1 },
                lastRetryAt: new Date(),
              },
            });

            createdSuccessfulUpdates.push(successfulUpdate);
            retryResults.push({
              id: failedUpdate.id,
              success: true,
              successfulUpdateId: successfulUpdate.id,
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
          createdSuccessfulUpdates,
          successCount,
          failureCount,
        },
      });
    }

    if (action === "delete-failed") {
      const { failedUpdateIds } = body;

      if (!Array.isArray(failedUpdateIds) || failedUpdateIds.length === 0) {
        return NextResponse.json(
          { success: false, error: "No failed update IDs provided" },
          { status: 400 },
        );
      }

      // Delete the failed lock updates
      const deleteResult = await db.failedLockUpdate.deleteMany({
        where: {
          id: { in: failedUpdateIds },
        },
      });

      return NextResponse.json({
        success: true,
        message: `${deleteResult.count} failed updates deleted successfully`,
        data: {
          deletedCount: deleteResult.count,
        },
      });
    }

    if (action === "prep") {
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

      // Trigger the prep daily task
      try {
        const prepRunId = await prepDailyTask();
        return NextResponse.json({
          success: true,
          message: "Prep daily task completed successfully",
          data: { prepRunId },
        });
      } catch (error) {
        console.error("Error in prep daily task:", error);
        return NextResponse.json(
          { success: false, error: "Failed to run prep daily task" },
          { status: 500 },
        );
      }
    }

    if (action === "execute") {
      const { prepRunId } = body;

      if (!prepRunId) {
        return NextResponse.json(
          { success: false, error: "Prep run ID is required" },
          { status: 400 },
        );
      }

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

      // Trigger the execute lock code updates
      try {
        await executeLockCodeUpdates(prepRunId);
        return NextResponse.json({
          success: true,
          message: "Lock code updates completed successfully",
        });
      } catch (error) {
        console.error("Error in execute lock code updates:", error);
        return NextResponse.json(
          { success: false, error: "Failed to execute lock code updates" },
          { status: 500 },
        );
      }
    }

    if (action === "update-prep-selection") {
      const { selectedPrepReservations } = body;

      if (
        !Array.isArray(selectedPrepReservations) ||
        selectedPrepReservations.length === 0
      ) {
        return NextResponse.json(
          { success: false, error: "No prep reservations provided" },
          { status: 400 },
        );
      }

      // Update the selection status of prep reservations
      try {
        const updatePromises = selectedPrepReservations.map(
          ({ id, isSelected }) =>
            db.prepReservation.update({
              where: { id },
              data: { isSelected },
            }),
        );

        await Promise.all(updatePromises);

        return NextResponse.json({
          success: true,
          message: "Prep reservation selection updated successfully",
        });
      } catch (error) {
        console.error("Error updating prep reservation selection:", error);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to update prep reservation selection",
          },
          { status: 500 },
        );
      }
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
