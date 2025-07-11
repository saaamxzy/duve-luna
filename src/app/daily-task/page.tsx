"use client";

import { useState, useEffect } from "react";

interface FailedLockUpdate {
  id: string;
  lockId: string;
  propertyName: string;
  fullAddress: string;
  guestName: string;
  error: string;
  errorType: string;
  retryCount: number;
  lastRetryAt: string | null;
}

interface DailyTaskRun {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  status: string;
  totalReservations: number;
  successfulUpdates: number;
  failedUpdates: number;
  error: string | null;
  failedLockUpdates: FailedLockUpdate[];
}

interface DailyTaskData {
  recentRuns: DailyTaskRun[];
  runningTask: DailyTaskRun | null;
  statistics: {
    totalRuns: number;
    totalFailedUpdates: number;
  };
}

interface DailyTaskApiResponse {
  success: boolean;
  data?: DailyTaskData;
  error?: string;
  message?: string;
}

export default function DailyTaskPage() {
  const [data, setData] = useState<DailyTaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFailedUpdates, setSelectedFailedUpdates] = useState<string[]>(
    [],
  );
  const [isRetrying, setIsRetrying] = useState(false);
  const [isTriggeringTask, setIsTriggeringTask] = useState(false);

  // Fetch daily task data
  const fetchData = async () => {
    try {
      const response = await fetch("/api/daily-task");
      const result = (await response.json()) as DailyTaskApiResponse;

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error ?? "Failed to fetch data");
      }
    } catch (_err) {
      setError("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  // Trigger daily task
  const triggerDailyTask = async () => {
    setIsTriggeringTask(true);
    try {
      const response = await fetch("/api/daily-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trigger" }),
      });

      const result = (await response.json()) as DailyTaskApiResponse;

      if (result.success) {
        alert("Daily task triggered successfully!");
        void fetchData(); // Refresh data
      } else {
        alert(result.error ?? "Failed to trigger task");
      }
    } catch (_err) {
      alert("Failed to trigger task");
    } finally {
      setIsTriggeringTask(false);
    }
  };

  // Retry failed lock updates
  const retryFailedUpdates = async () => {
    if (selectedFailedUpdates.length === 0) {
      alert("Please select at least one failed update to retry");
      return;
    }

    setIsRetrying(true);
    try {
      const response = await fetch("/api/daily-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "retry-failed",
          failedUpdateIds: selectedFailedUpdates,
        }),
      });

      const result = (await response.json()) as DailyTaskApiResponse;

      if (result.success) {
        alert(result.message);
        setSelectedFailedUpdates([]);
        void fetchData(); // Refresh data
      } else {
        alert(result.error ?? "Failed to retry updates");
      }
    } catch (_err) {
      alert("Failed to retry updates");
    } finally {
      setIsRetrying(false);
    }
  };

  // Toggle failed update selection
  const toggleFailedUpdate = (updateId: string) => {
    setSelectedFailedUpdates((prev) =>
      prev.includes(updateId)
        ? prev.filter((id) => id !== updateId)
        : [...prev, updateId],
    );
  };

  // Select all failed updates
  const selectAllFailedUpdates = () => {
    if (!data) return;

    const allFailedUpdates = data.recentRuns.flatMap((run) =>
      run.failedLockUpdates.map((update) => update.id),
    );

    setSelectedFailedUpdates(allFailedUpdates);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedFailedUpdates([]);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Format duration
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  useEffect(() => {
    void fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => void fetchData(), 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex h-64 items-center justify-center">
          <div className="text-lg">Loading daily task data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded border border-red-400 bg-red-100 px-4 py-3 text-red-700">
          Error: {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">No data available</div>
      </div>
    );
  }

  const allFailedUpdates = data.recentRuns.flatMap(
    (run) => run.failedLockUpdates,
  );
  const totalFailedUpdates = allFailedUpdates.length;

  return (
    <div className="container mx-auto space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Daily Task Management</h1>
        <div className="flex space-x-3">
          <button
            onClick={fetchData}
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50"
            disabled={loading}
          >
            Refresh
          </button>
          <button
            onClick={triggerDailyTask}
            className="rounded bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:opacity-50"
            disabled={isTriggeringTask || !!data.runningTask}
          >
            {isTriggeringTask ? "Triggering..." : "Trigger Daily Task"}
          </button>
        </div>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="text-lg font-semibold text-gray-700">
            Current Status
          </h3>
          <p className="text-2xl font-bold text-blue-600">
            {data.runningTask ? "Running" : "Idle"}
          </p>
          {data.runningTask && (
            <p className="text-sm text-gray-600">
              Started: {formatDate(data.runningTask.startTime)}
            </p>
          )}
        </div>

        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="text-lg font-semibold text-gray-700">Total Runs</h3>
          <p className="text-2xl font-bold text-green-600">
            {data.statistics.totalRuns}
          </p>
        </div>

        <div className="rounded-lg bg-white p-4 shadow">
          <h3 className="text-lg font-semibold text-gray-700">
            Failed Updates
          </h3>
          <p className="text-2xl font-bold text-red-600">
            {data.statistics.totalFailedUpdates}
          </p>
        </div>
      </div>

      {/* Recent Runs */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">Recent Task Runs</h2>
        <div className="overflow-x-auto">
          <table className="w-full table-auto">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-4 py-2 text-left">Start Time</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Duration</th>
                <th className="px-4 py-2 text-left">Processed</th>
                <th className="px-4 py-2 text-left">Success</th>
                <th className="px-4 py-2 text-left">Failed</th>
                <th className="px-4 py-2 text-left">Error</th>
              </tr>
            </thead>
            <tbody>
              {data.recentRuns.map((run) => (
                <tr key={run.id} className="border-b">
                  <td className="px-4 py-2">{formatDate(run.startTime)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-2 py-1 text-xs font-medium ${
                        run.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : run.status === "running"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {run.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {run.duration ? formatDuration(run.duration) : "N/A"}
                  </td>
                  <td className="px-4 py-2">{run.totalReservations}</td>
                  <td className="px-4 py-2 text-green-600">
                    {run.successfulUpdates}
                  </td>
                  <td className="px-4 py-2 text-red-600">
                    {run.failedUpdates}
                  </td>
                  <td className="px-4 py-2 text-sm text-red-600">
                    {run.error ? run.error.substring(0, 50) + "..." : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Failed Lock Updates */}
      {totalFailedUpdates > 0 && (
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Failed Lock Updates</h2>
            <div className="flex space-x-2">
              <button
                onClick={selectAllFailedUpdates}
                className="rounded bg-gray-500 px-3 py-1 text-sm text-white hover:bg-gray-600"
              >
                Select All
              </button>
              <button
                onClick={clearSelection}
                className="rounded bg-gray-500 px-3 py-1 text-sm text-white hover:bg-gray-600"
              >
                Clear Selection
              </button>
              <button
                onClick={retryFailedUpdates}
                className="rounded bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-50"
                disabled={isRetrying || selectedFailedUpdates.length === 0}
              >
                {isRetrying
                  ? "Retrying..."
                  : `Retry Selected (${selectedFailedUpdates.length})`}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-auto">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left">Select</th>
                  <th className="px-4 py-2 text-left">Property</th>
                  <th className="px-4 py-2 text-left">Guest</th>
                  <th className="px-4 py-2 text-left">Lock ID</th>
                  <th className="px-4 py-2 text-left">Error</th>
                  <th className="px-4 py-2 text-left">Retry Count</th>
                  <th className="px-4 py-2 text-left">Last Retry</th>
                </tr>
              </thead>
              <tbody>
                {allFailedUpdates.map((update) => (
                  <tr key={update.id} className="border-b">
                    <td className="px-4 py-2">
                      <input
                        type="checkbox"
                        checked={selectedFailedUpdates.includes(update.id)}
                        onChange={() => toggleFailedUpdate(update.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{update.propertyName}</div>
                      <div className="text-sm text-gray-600">
                        {update.fullAddress}
                      </div>
                    </td>
                    <td className="px-4 py-2">{update.guestName}</td>
                    <td className="px-4 py-2 font-mono text-sm">
                      {update.lockId}
                    </td>
                    <td className="px-4 py-2 text-sm text-red-600">
                      {update.error.substring(0, 50)}
                      {update.error.length > 50 && "..."}
                    </td>
                    <td className="px-4 py-2">{update.retryCount}</td>
                    <td className="px-4 py-2 text-sm">
                      {update.lastRetryAt
                        ? formatDate(update.lastRetryAt)
                        : "Never"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalFailedUpdates === 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800">
          <p className="font-medium">🎉 No failed lock updates!</p>
          <p className="text-sm">
            All recent lock updates have been successful.
          </p>
        </div>
      )}
    </div>
  );
}
