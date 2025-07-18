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
  startDate: string;
  endDate: string;
  duveId: string;
  reservationId: string;
  retrySuccessful?: boolean;
}

interface SuccessfulLockUpdate {
  id: string;
  lockId: string;
  propertyName: string;
  fullAddress: string;
  guestName: string;
  lockCode: string;
  lockCodeStart: string;
  lockCodeEnd: string;
  processingTime: number | null;
  startDate: string;
  endDate: string;
  duveId: string;
  reservationId: string;
}

interface DailyTaskRun {
  id: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  status: string;
  taskType: string;
  totalReservations: number;
  successfulUpdates: number;
  failedUpdates: number;
  error: string | null;
  failedLockUpdates: FailedLockUpdate[];
  successfulLockUpdates: SuccessfulLockUpdate[];
}

interface PrepReservation {
  id: string;
  reservationId: string;
  duveId: string;
  propertyName: string;
  fullAddress: string;
  guestName: string;
  startDate: string;
  endDate: string;
  lockId: string | null;
  lockName: string | null;
  streetNumber: string;
  currentLockCode: string | null;
  isSelected: boolean;
  canUpdate: boolean;
  reasonCannotUpdate: string | null;
  processed: boolean;
  processedAt: string | null;
}

interface PrepTaskData {
  prepRun: DailyTaskRun;
  prepReservations: PrepReservation[];
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

interface DailyTaskRunDetailResponse {
  success: boolean;
  data?: { run: DailyTaskRun };
  error?: string;
}

interface RetryApiResponse {
  success: boolean;
  message?: string;
  data?: {
    retryResults: Array<{
      id: string;
      success: boolean;
      successfulUpdateId?: string;
      error?: string;
    }>;
    createdSuccessfulUpdates: SuccessfulLockUpdate[];
    successCount: number;
    failureCount: number;
  };
  error?: string;
}

interface DeleteFailedApiResponse {
  success: boolean;
  message?: string;
  data?: {
    deletedCount: number;
  };
  error?: string;
}

export default function DailyTaskPage() {
  const [data, setData] = useState<DailyTaskData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFailedUpdates, setSelectedFailedUpdates] = useState<string[]>(
    [],
  );
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeletingFailed, setIsDeletingFailed] = useState(false);
  const [isTriggeringTask, setIsTriggeringTask] = useState(false);
  const [selectedRun, setSelectedRun] = useState<DailyTaskRun | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [runDetails, setRunDetails] = useState<DailyTaskRun | null>(null);
  const [isLoadingRunDetails, setIsLoadingRunDetails] = useState(false);
  const [isKillingTask, setIsKillingTask] = useState(false);

  // Prep phase state
  const [prepData, setPrepData] = useState<PrepTaskData | null>(null);
  const [isPrepPhase, setIsPrepPhase] = useState(false);
  const [isPrepping, setIsPrepping] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

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
    } catch {
      setError("Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  // Trigger daily task (legacy - full process)
  const triggerDailyTask = async () => {
    const confirmTrigger = confirm(
      "Are you sure you want to trigger the daily task? This will process all reservations and update lock codes. This action cannot be undone.",
    );

    if (!confirmTrigger) return;

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
    } catch {
      alert("Failed to trigger task");
    } finally {
      setIsTriggeringTask(false);
    }
  };

  // Prep daily task
  const prepDailyTask = async () => {
    const confirmPrep = confirm(
      "Are you sure you want to prep the daily task? This will fetch reservations and update lock profiles without making any lock code changes.",
    );

    if (!confirmPrep) return;

    setIsPrepping(true);
    try {
      const response = await fetch("/api/daily-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prep" }),
      });

      const result = (await response.json()) as DailyTaskApiResponse & {
        data?: { prepRunId: string };
      };

      if (result.success && result.data?.prepRunId) {
        alert("Prep daily task completed successfully!");
        // Fetch prep data
        await fetchPrepData(result.data.prepRunId);
        setIsPrepPhase(true);
        void fetchData(); // Refresh data
      } else {
        alert(result.error ?? "Failed to prep task");
      }
    } catch {
      alert("Failed to prep task");
    } finally {
      setIsPrepping(false);
    }
  };

  // Fetch prep data
  const fetchPrepData = async (prepRunId: string) => {
    try {
      const response = await fetch(`/api/daily-task?prepRunId=${prepRunId}`);
      const result = (await response.json()) as DailyTaskApiResponse & {
        data?: PrepTaskData;
      };

      if (result.success && result.data) {
        setPrepData(result.data);
      } else {
        alert(result.error ?? "Failed to fetch prep data");
      }
    } catch {
      alert("Failed to fetch prep data");
    }
  };

  // Execute lock code updates
  const executeLockCodeUpdates = async () => {
    if (!prepData) return;

    const selectedCount = prepData.prepReservations.filter(
      (r) => r.isSelected && r.canUpdate,
    ).length;

    if (selectedCount === 0) {
      alert("No reservations selected for update");
      return;
    }

    const confirmExecute = confirm(
      `Are you sure you want to update lock codes for ${selectedCount} selected reservations? This action cannot be undone.`,
    );

    if (!confirmExecute) return;

    setIsExecuting(true);
    try {
      const response = await fetch("/api/daily-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "execute",
          prepRunId: prepData.prepRun.id,
        }),
      });

      const result = (await response.json()) as DailyTaskApiResponse;

      if (result.success) {
        alert("Lock code updates completed successfully!");
        setIsPrepPhase(false);
        setPrepData(null);
        void fetchData(); // Refresh data
      } else {
        alert(result.error ?? "Failed to execute lock code updates");
      }
    } catch {
      alert("Failed to execute lock code updates");
    } finally {
      setIsExecuting(false);
    }
  };

  // Update prep reservation selection
  const updatePrepSelection = async (
    reservationId: string,
    isSelected: boolean,
  ) => {
    if (!prepData) return;

    // Update local state immediately
    setPrepData({
      ...prepData,
      prepReservations: prepData.prepReservations.map((r) =>
        r.id === reservationId ? { ...r, isSelected } : r,
      ),
    });

    // Update server
    try {
      const response = await fetch("/api/daily-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update-prep-selection",
          selectedPrepReservations: [{ id: reservationId, isSelected }],
        }),
      });

      const result = (await response.json()) as DailyTaskApiResponse;

      if (!result.success) {
        console.error("Failed to update prep selection:", result.error);
        // Revert local state on failure
        setPrepData({
          ...prepData,
          prepReservations: prepData.prepReservations.map((r) =>
            r.id === reservationId ? { ...r, isSelected: !isSelected } : r,
          ),
        });
      }
    } catch {
      console.error("Failed to update prep selection");
      // Revert local state on failure
      setPrepData({
        ...prepData,
        prepReservations: prepData.prepReservations.map((r) =>
          r.id === reservationId ? { ...r, isSelected: !isSelected } : r,
        ),
      });
    }
  };

  // Cancel prep phase
  const cancelPrepPhase = () => {
    setIsPrepPhase(false);
    setPrepData(null);
  };

  // Kill running task
  const killRunningTask = async () => {
    if (!data?.runningTask) return;

    const confirmKill = confirm(
      "Are you sure you want to kill the running task? This will stop the task immediately and mark it as killed.",
    );

    if (!confirmKill) return;

    setIsKillingTask(true);
    try {
      const response = await fetch("/api/daily-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "kill", taskId: data.runningTask.id }),
      });

      const result = (await response.json()) as DailyTaskApiResponse;

      if (result.success) {
        alert("Task killed successfully!");
        void fetchData(); // Refresh data
      } else {
        alert(result.error ?? "Failed to kill task");
      }
    } catch {
      alert("Failed to kill task");
    } finally {
      setIsKillingTask(false);
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

      const result = (await response.json()) as RetryApiResponse;

      if (result.success) {
        // Show success message with retry results
        const successCount = result.data?.successCount ?? 0;
        const failureCount = result.data?.failureCount ?? 0;
        alert(`Retry completed: ${successCount} successful, ${failureCount} failed`);
        
        setSelectedFailedUpdates([]);
        void fetchData(); // Refresh data
      } else {
        alert(result.error ?? "Failed to retry updates");
      }
    } catch {
      alert("Failed to retry updates");
    } finally {
      setIsRetrying(false);
    }
  };

  // Delete failed lock updates
  const deleteFailedUpdates = async () => {
    if (selectedFailedUpdates.length === 0) {
      alert("Please select at least one failed update to delete");
      return;
    }

    const confirmDelete = confirm(
      `Are you sure you want to delete ${selectedFailedUpdates.length} failed update(s)? This action cannot be undone.`,
    );

    if (!confirmDelete) return;

    setIsDeletingFailed(true);
    try {
      const response = await fetch("/api/daily-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete-failed",
          failedUpdateIds: selectedFailedUpdates,
        }),
      });

      const result = (await response.json()) as DeleteFailedApiResponse;

      if (result.success) {
        alert(result.message ?? "Failed updates deleted successfully");
        setSelectedFailedUpdates([]);
        void fetchData(); // Refresh data
      } else {
        alert(result.error ?? "Failed to delete updates");
      }
    } catch {
      alert("Failed to delete updates");
    } finally {
      setIsDeletingFailed(false);
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

  // Fetch run details
  const fetchRunDetails = async (runId: string) => {
    setIsLoadingRunDetails(true);
    try {
      const response = await fetch(`/api/daily-task?runId=${runId}`);
      const result = (await response.json()) as DailyTaskRunDetailResponse;

      if (result.success && result.data) {
        setRunDetails(result.data.run);
      } else {
        alert(result.error ?? "Failed to fetch run details");
      }
    } catch {
      alert("Failed to fetch run details");
    } finally {
      setIsLoadingRunDetails(false);
    }
  };

  // Handle clicking on a run
  const handleRunClick = async (run: DailyTaskRun) => {
    setSelectedRun(run);
    setIsModalOpen(true);
    await fetchRunDetails(run.id);
  };

  // Close modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRun(null);
    setRunDetails(null);
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

  // Calculate how long a task has been running
  const getRunningDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const duration = now.getTime() - start.getTime();
    return formatDuration(duration);
  };

  // Check if a task has been running for too long (> 30 minutes)
  const isRunningTooLong = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const duration = now.getTime() - start.getTime();
    return duration > 30 * 60 * 1000; // 30 minutes
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
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-friendly header */}
      <div className="border-b bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Daily Task Management
          </h1>
          <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-3">
            <button
              onClick={fetchData}
              className="w-full rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:opacity-50 sm:w-auto"
              disabled={loading}
            >
              Refresh
            </button>

            {!isPrepPhase && (
              <>
                <button
                  onClick={prepDailyTask}
                  className="w-full rounded-md bg-purple-500 px-4 py-2 text-white hover:bg-purple-600 disabled:opacity-50 sm:w-auto"
                  disabled={isPrepping || !!data.runningTask}
                >
                  {isPrepping ? "Prepping..." : "Prep Daily Task"}
                </button>
                <button
                  onClick={triggerDailyTask}
                  className="w-full rounded-md bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:opacity-50 sm:w-auto"
                  disabled={isTriggeringTask || !!data.runningTask}
                >
                  {isTriggeringTask
                    ? "Triggering..."
                    : "Trigger Daily Task (Legacy)"}
                </button>
              </>
            )}

            {isPrepPhase && prepData && (
              <>
                <button
                  onClick={executeLockCodeUpdates}
                  className="w-full rounded-md bg-green-500 px-4 py-2 text-white hover:bg-green-600 disabled:opacity-50 sm:w-auto"
                  disabled={
                    isExecuting ||
                    prepData.prepReservations.filter(
                      (r) => r.isSelected && r.canUpdate,
                    ).length === 0
                  }
                >
                  {isExecuting
                    ? "Updating..."
                    : `Update Lock Codes (${prepData.prepReservations.filter((r) => r.isSelected && r.canUpdate).length})`}
                </button>
                <button
                  onClick={cancelPrepPhase}
                  className="w-full rounded-md bg-gray-500 px-4 py-2 text-white hover:bg-gray-600 disabled:opacity-50 sm:w-auto"
                  disabled={isExecuting}
                >
                  Cancel Prep
                </button>
              </>
            )}

            {data.runningTask && (
              <button
                onClick={killRunningTask}
                className="w-full rounded-md bg-red-500 px-4 py-2 text-white hover:bg-red-600 disabled:opacity-50 sm:w-auto"
                disabled={isKillingTask}
              >
                {isKillingTask ? "Killing..." : "Kill Running Task"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto space-y-6 p-4 sm:p-6">
        {/* Current Status - Mobile-friendly cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-700">
              Current Status
            </h3>
            <p className="text-2xl font-bold text-blue-600">
              {data.runningTask ? "Running" : "Idle"}
            </p>
            {data.runningTask && (
              <div className="mt-2 text-sm text-gray-600">
                <p>Started: {formatDate(data.runningTask.startTime)}</p>
                <p
                  className={
                    isRunningTooLong(data.runningTask.startTime)
                      ? "font-medium text-red-600"
                      : ""
                  }
                >
                  Duration: {getRunningDuration(data.runningTask.startTime)}
                  {isRunningTooLong(data.runningTask.startTime) && " ⚠️"}
                </p>
                {isRunningTooLong(data.runningTask.startTime) && (
                  <p className="mt-1 text-xs text-red-600">
                    Task has been running for too long. Consider killing it.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-700">Total Runs</h3>
            <p className="text-2xl font-bold text-green-600">
              {data.statistics.totalRuns}
            </p>
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm sm:col-span-2 lg:col-span-1">
            <h3 className="text-lg font-semibold text-gray-700">
              Failed Updates
            </h3>
            <p className="text-2xl font-bold text-red-600">
              {data.statistics.totalFailedUpdates}
            </p>
          </div>
        </div>

        {/* Prep Phase - Reservation Selection */}
        {isPrepPhase && prepData && (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b px-4 py-4 sm:px-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Prep Phase - Select Reservations to Update
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                Select which reservations should have their lock codes updated.
                Only reservations that can be updated are selectable.
              </p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-green-800">
                  Can Update:{" "}
                  {prepData.prepReservations.filter((r) => r.canUpdate).length}
                </span>
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-red-800">
                  Cannot Update:{" "}
                  {prepData.prepReservations.filter((r) => !r.canUpdate).length}
                </span>
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-blue-800">
                  Selected:{" "}
                  {
                    prepData.prepReservations.filter(
                      (r) => r.isSelected && r.canUpdate,
                    ).length
                  }
                </span>
              </div>
            </div>

            {/* Mobile: Card layout */}
            <div className="block sm:hidden">
              <div className="divide-y divide-gray-200">
                {prepData.prepReservations.map((reservation) => (
                  <div key={reservation.id} className="p-4">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={reservation.isSelected}
                        onChange={(e) =>
                          updatePrepSelection(reservation.id, e.target.checked)
                        }
                        disabled={!reservation.canUpdate}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {reservation.propertyName}
                          </p>
                          <div className="flex items-center space-x-2">
                            {reservation.canUpdate ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                                Can Update
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">
                                Cannot Update
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          {reservation.fullAddress}
                        </p>
                        <p className="mt-1 text-sm text-gray-900">
                          Guest: {reservation.guestName}
                        </p>
                        <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                          <span>
                            Check-in: {formatDate(reservation.startDate)}
                          </span>
                          <span>
                            Check-out: {formatDate(reservation.endDate)}
                          </span>
                        </div>
                        {reservation.lockId && (
                          <p className="mt-1 font-mono text-xs text-gray-500">
                            Lock ID: {reservation.lockId}
                          </p>
                        )}
                        {!reservation.canUpdate &&
                          reservation.reasonCannotUpdate && (
                            <p className="mt-2 text-sm text-red-600">
                              {reservation.reasonCannotUpdate}
                            </p>
                          )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: Table layout */}
            <div className="hidden sm:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Select
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Property
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Guest
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Check-in
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Check-out
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Lock ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {prepData.prepReservations.map((reservation) => (
                      <tr
                        key={reservation.id}
                        className={reservation.canUpdate ? "" : "bg-gray-50"}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={reservation.isSelected}
                            onChange={(e) =>
                              updatePrepSelection(
                                reservation.id,
                                e.target.checked,
                              )
                            }
                            disabled={!reservation.canUpdate}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {reservation.propertyName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {reservation.fullAddress}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                          {reservation.guestName}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                          {formatDate(reservation.startDate)}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                          {formatDate(reservation.endDate)}
                        </td>
                        <td className="px-6 py-4 font-mono text-sm whitespace-nowrap text-gray-900">
                          {reservation.lockId ?? "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {reservation.canUpdate ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                              Can Update
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                                Cannot Update
                              </span>
                              {reservation.reasonCannotUpdate && (
                                <div className="mt-1 text-xs text-red-600">
                                  {reservation.reasonCannotUpdate}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Recent Runs - Mobile-friendly */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b px-4 py-4 sm:px-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Recent Task Runs
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Click on any run to view detailed information about successful and
              failed lock updates.
            </p>
          </div>

          {/* Mobile: Card layout, Desktop: Table layout */}
          <div className="block sm:hidden">
            <div className="divide-y divide-gray-200">
              {data.recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="cursor-pointer p-4 hover:bg-gray-50"
                  onClick={() => handleRunClick(run)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(run.startTime)}
                      </p>
                      <div className="mt-1 flex items-center space-x-2">
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                            run.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : run.status === "running"
                                ? "bg-blue-100 text-blue-800"
                                : run.status === "killed"
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-red-100 text-red-800"
                          }`}
                        >
                          {run.status}
                        </span>
                        <span
                          className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                            run.taskType === "prep"
                              ? "bg-purple-100 text-purple-800"
                              : run.taskType === "execute"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {run.taskType === "prep"
                            ? "Prep"
                            : run.taskType === "execute"
                              ? "Execute"
                              : "Full"}
                        </span>
                        <span className="text-sm text-gray-500">
                          {run.duration ? formatDuration(run.duration) : "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end text-sm">
                      <span className="text-gray-600">
                        {run.totalReservations} processed
                      </span>
                      <div className="mt-1 flex space-x-2">
                        <span className="text-green-600">
                          ✓ {run.successfulUpdates}
                        </span>
                        <span className="text-red-600">
                          ✗ {run.failedUpdates}
                        </span>
                      </div>
                    </div>
                  </div>
                  {run.error && (
                    <p className="mt-2 truncate text-sm text-red-600">
                      {run.error.substring(0, 50)}...
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Desktop: Table layout */}
          <div className="hidden sm:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Start Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Processed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Success
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Failed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {data.recentRuns.map((run) => (
                    <tr
                      key={run.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => handleRunClick(run)}
                    >
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                        {formatDate(run.startTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            run.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : run.status === "running"
                                ? "bg-blue-100 text-blue-800"
                                : run.status === "killed"
                                  ? "bg-orange-100 text-orange-800"
                                  : "bg-red-100 text-red-800"
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            run.taskType === "prep"
                              ? "bg-purple-100 text-purple-800"
                              : run.taskType === "execute"
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {run.taskType === "prep"
                            ? "Prep"
                            : run.taskType === "execute"
                              ? "Execute"
                              : "Full"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                        {run.duration ? formatDuration(run.duration) : "N/A"}
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                        {run.totalReservations}
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-green-600">
                        {run.successfulUpdates}
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-red-600">
                        {run.failedUpdates}
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap text-red-600">
                        {run.error ? run.error.substring(0, 50) + "..." : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Failed Lock Updates - Mobile-friendly */}
        {totalFailedUpdates > 0 && (
          <div className="rounded-lg border bg-white shadow-sm">
            <div className="border-b px-4 py-4 sm:px-6">
              <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <h2 className="text-xl font-semibold text-gray-900">
                  Failed Lock Updates
                </h2>
                <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                  <button
                    onClick={selectAllFailedUpdates}
                    className="w-full rounded-md bg-gray-500 px-3 py-1 text-sm text-white hover:bg-gray-600 sm:w-auto"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="w-full rounded-md bg-gray-500 px-3 py-1 text-sm text-white hover:bg-gray-600 sm:w-auto"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={retryFailedUpdates}
                    className="w-full rounded-md bg-orange-500 px-4 py-2 text-white hover:bg-orange-600 disabled:opacity-50 sm:w-auto"
                    disabled={isRetrying || selectedFailedUpdates.length === 0}
                  >
                    {isRetrying
                      ? "Retrying..."
                      : `Retry Selected (${selectedFailedUpdates.length})`}
                  </button>
                  <button
                    onClick={deleteFailedUpdates}
                    className="w-full rounded-md bg-red-500 px-4 py-2 text-white hover:bg-red-600 disabled:opacity-50 sm:w-auto"
                    disabled={isDeletingFailed || selectedFailedUpdates.length === 0}
                  >
                    {isDeletingFailed ? "Deleting..." : "Delete Selected"}
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile: Card layout, Desktop: Table layout */}
            <div className="block sm:hidden">
              <div className="divide-y divide-gray-200">
                {allFailedUpdates.map((update) => (
                  <div key={update.id} className="p-4">
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedFailedUpdates.includes(update.id)}
                        onChange={() => toggleFailedUpdate(update.id)}
                        className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {update.propertyName}
                          </p>
                          <p className="font-mono text-sm text-gray-500">
                            {update.lockId}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-gray-600">
                          {update.fullAddress}
                        </p>
                        <p className="mt-1 text-sm text-gray-900">
                          Guest: {update.guestName}
                        </p>
                        <p className="mt-2 text-sm text-red-600">
                          {update.error.substring(0, 100)}
                          {update.error.length > 100 && "..."}
                        </p>
                        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                          <span>Retry Count: {update.retryCount}</span>
                          <span>
                            Last Retry:{" "}
                            {update.lastRetryAt
                              ? formatDate(update.lastRetryAt)
                              : "Never"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Desktop: Table layout */}
            <div className="hidden sm:block">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Select
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Property
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Guest
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Lock ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Error
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Retry Count
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                        Last Retry
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {allFailedUpdates.map((update) => (
                      <tr key={update.id}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedFailedUpdates.includes(update.id)}
                            onChange={() => toggleFailedUpdate(update.id)}
                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {update.propertyName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {update.fullAddress}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                          {update.guestName}
                        </td>
                        <td className="px-6 py-4 font-mono text-sm whitespace-nowrap text-gray-900">
                          {update.lockId}
                        </td>
                        <td className="px-6 py-4 text-sm text-red-600">
                          <div className="max-w-xs truncate">
                            {update.error.substring(0, 50)}
                            {update.error.length > 50 && "..."}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                          {update.retryCount}
                        </td>
                        <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
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

        {/* Run Details Modal - Mobile-friendly */}
        {isModalOpen && (
          <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
            <div className="max-h-[90vh] w-full max-w-7xl overflow-hidden rounded-lg bg-white shadow-lg">
              <div className="flex items-center justify-between border-b p-4 sm:p-6">
                <h2 className="text-xl font-bold sm:text-2xl">
                  Run Details -{" "}
                  {selectedRun && formatDate(selectedRun.startTime)}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-1 text-2xl text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>

              <div className="max-h-[80vh] overflow-y-auto p-4 sm:p-6">
                {isLoadingRunDetails ? (
                  <div className="flex h-64 items-center justify-center">
                    <div className="text-lg">Loading run details...</div>
                  </div>
                ) : runDetails ? (
                  <div className="space-y-6">
                    {/* Run Summary - Mobile-friendly grid */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-lg bg-gray-50 p-4">
                        <h3 className="font-semibold text-gray-700">Status</h3>
                        <p className="text-xl font-bold text-blue-600">
                          {runDetails.status}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-4">
                        <h3 className="font-semibold text-gray-700">
                          Duration
                        </h3>
                        <p className="text-xl font-bold text-green-600">
                          {runDetails.duration
                            ? formatDuration(runDetails.duration)
                            : "N/A"}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-4">
                        <h3 className="font-semibold text-gray-700">
                          Total Processed
                        </h3>
                        <p className="text-xl font-bold text-blue-600">
                          {runDetails.totalReservations}
                        </p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-4">
                        <h3 className="font-semibold text-gray-700">
                          Success Rate
                        </h3>
                        <p className="text-xl font-bold text-green-600">
                          {runDetails.totalReservations > 0
                            ? Math.round(
                                (runDetails.successfulUpdates /
                                  runDetails.totalReservations) *
                                  100,
                              )
                            : 0}
                          %
                        </p>
                      </div>
                    </div>

                    {/* Successful Lock Updates - Mobile-friendly */}
                    {runDetails.successfulLockUpdates &&
                      runDetails.successfulLockUpdates.length > 0 && (
                        <div className="rounded-lg bg-green-50 p-4">
                          <h3 className="mb-4 text-lg font-semibold text-green-800">
                            Successful Lock Updates (
                            {runDetails.successfulLockUpdates.length})
                          </h3>

                          {/* Mobile: Card layout */}
                          <div className="block space-y-3 sm:hidden">
                            {runDetails.successfulLockUpdates.map((update) => {
                              // Check if this update was created from a retry
                              const isFromRetry = runDetails.failedLockUpdates.some(
                                (failedUpdate) => 
                                  failedUpdate.lockId === update.lockId &&
                                  failedUpdate.reservationId === update.reservationId &&
                                  failedUpdate.retrySuccessful
                              );
                              
                              return (
                                <div
                                  key={update.id}
                                  className="rounded border bg-white p-3"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2">
                                        <p className="font-medium text-gray-900">
                                          {update.propertyName}
                                        </p>
                                        {isFromRetry ? (
                                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                                            From Retry
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                                            Original
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-sm text-gray-600">
                                        {update.fullAddress}
                                      </p>
                                      <p className="text-sm text-gray-900">
                                        Guest: {update.guestName}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-mono text-sm text-gray-700">
                                        {update.lockId}
                                      </p>
                                      <p className="font-mono text-sm font-bold text-green-700">
                                        {update.lockCode}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="mt-2 text-xs text-gray-500">
                                    <p>
                                      Check-in: {formatDate(update.startDate)}
                                    </p>
                                    <p>Check-out: {formatDate(update.endDate)}</p>
                                    <p>
                                      Processing:{" "}
                                      {update.processingTime
                                        ? `${update.processingTime}ms`
                                        : "N/A"}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Desktop: Table layout */}
                          <div className="hidden overflow-x-auto sm:block">
                            <table className="w-full table-auto">
                              <thead>
                                <tr className="bg-green-100">
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                    Property
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                    Guest
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                    Lock ID
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                    Lock Code
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                    Check-in
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                    Check-out
                                  </th>
                                                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                      Processing Time
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                      Status
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {runDetails.successfulLockUpdates.map(
                                    (update) => {
                                      // Check if this update was created from a retry
                                      // We can determine this by checking if there's a failed update with same details
                                      const isFromRetry = runDetails.failedLockUpdates.some(
                                        (failedUpdate) => 
                                          failedUpdate.lockId === update.lockId &&
                                          failedUpdate.reservationId === update.reservationId &&
                                          failedUpdate.retrySuccessful
                                      );
                                      
                                      return (
                                        <tr
                                          key={update.id}
                                          className="border-b border-green-200"
                                        >
                                          <td className="px-4 py-2">
                                            <div className="font-medium">
                                              {update.propertyName}
                                            </div>
                                            <div className="text-sm text-gray-600">
                                              {update.fullAddress}
                                            </div>
                                          </td>
                                          <td className="px-4 py-2">
                                            {update.guestName}
                                          </td>
                                          <td className="px-4 py-2 font-mono text-sm">
                                            {update.lockId}
                                          </td>
                                          <td className="px-4 py-2 font-mono text-sm font-bold text-green-700">
                                            {update.lockCode}
                                          </td>
                                          <td className="px-4 py-2 text-sm">
                                            {formatDate(update.startDate)}
                                          </td>
                                          <td className="px-4 py-2 text-sm">
                                            {formatDate(update.endDate)}
                                          </td>
                                          <td className="px-4 py-2 text-sm">
                                            {update.processingTime
                                              ? `${update.processingTime}ms`
                                              : "N/A"}
                                          </td>
                                          <td className="px-4 py-2 text-sm">
                                            {isFromRetry ? (
                                              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">
                                                From Retry
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                                                Original
                                              </span>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    },
                                  )}
                                </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                    {/* Failed Lock Updates - Mobile-friendly */}
                    {runDetails.failedLockUpdates &&
                      runDetails.failedLockUpdates.length > 0 && (
                        <div className="rounded-lg bg-red-50 p-4">
                          <h3 className="mb-4 text-lg font-semibold text-red-800">
                            Failed Lock Updates (
                            {runDetails.failedLockUpdates.length})
                          </h3>

                          {/* Mobile: Card layout */}
                          <div className="block space-y-3 sm:hidden">
                            {runDetails.failedLockUpdates.map((update) => (
                              <div
                                key={update.id}
                                className="rounded border bg-white p-3"
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">
                                      {update.propertyName}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {update.fullAddress}
                                    </p>
                                    <p className="text-sm text-gray-900">
                                      Guest: {update.guestName}
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-mono text-sm text-gray-700">
                                      {update.lockId}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      Retries: {update.retryCount}
                                    </p>
                                  </div>
                                </div>
                                <div className="mt-2 text-sm text-red-600">
                                  {update.error.substring(0, 100)}
                                  {update.error.length > 100 && "..."}
                                </div>
                                <div className="mt-2 text-xs text-gray-500">
                                  <p>
                                    Check-in: {formatDate(update.startDate)}
                                  </p>
                                  <p>Check-out: {formatDate(update.endDate)}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Desktop: Table layout */}
                          <div className="hidden overflow-x-auto sm:block">
                            <table className="w-full table-auto">
                              <thead>
                                <tr className="bg-red-100">
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                    Property
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                    Guest
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                    Lock ID
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                    Error
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                    Check-in
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                    Check-out
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700 uppercase">
                                    Retry Count
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {runDetails.failedLockUpdates.map((update) => (
                                  <tr
                                    key={update.id}
                                    className="border-b border-red-200"
                                  >
                                    <td className="px-4 py-2">
                                      <div className="font-medium">
                                        {update.propertyName}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        {update.fullAddress}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      {update.guestName}
                                    </td>
                                    <td className="px-4 py-2 font-mono text-sm">
                                      {update.lockId}
                                    </td>
                                    <td className="px-4 py-2 text-sm text-red-600">
                                      <div className="max-w-xs">
                                        {update.error.substring(0, 50)}
                                        {update.error.length > 50 && "..."}
                                      </div>
                                    </td>
                                    <td className="px-4 py-2 text-sm">
                                      {formatDate(update.startDate)}
                                    </td>
                                    <td className="px-4 py-2 text-sm">
                                      {formatDate(update.endDate)}
                                    </td>
                                    <td className="px-4 py-2">
                                      {update.retryCount}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                    {/* No Updates */}
                    {(!runDetails.successfulLockUpdates ||
                      runDetails.successfulLockUpdates.length === 0) &&
                      (!runDetails.failedLockUpdates ||
                        runDetails.failedLockUpdates.length === 0) && (
                        <div className="py-8 text-center">
                          <p className="text-gray-500">
                            No lock updates found for this run.
                          </p>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-gray-500">Failed to load run details.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
