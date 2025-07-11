"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { LockProfile, KeyboardPassword } from "@prisma/client";

interface LockDetailResponse {
  lock: LockProfile & {
    keyboardPasswords: KeyboardPassword[];
  };
}

function isLockDetailResponse(data: unknown): data is LockDetailResponse {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as { lock?: unknown };
  if (!obj.lock || typeof obj.lock !== "object" || obj.lock === null)
    return false;
  const lock = obj.lock as { keyboardPasswords?: unknown };
  return Array.isArray(lock.keyboardPasswords);
}

export default function LockDetailPage() {
  const params = useParams();
  const [lock, setLock] = useState<LockDetailResponse["lock"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLockDetail = async () => {
      try {
        const response = await fetch(
          `/api/locks/${encodeURIComponent(String(params.id))}`,
        );
        const data: unknown = await response.json();
        if (isLockDetailResponse(data)) {
          setLock(data.lock);
        } else {
          throw new Error("Invalid API response");
        }
      } catch (error) {
        console.error("Error fetching lock details:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchLockDetail();
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading lock details...</div>
      </div>
    );
  }

  if (!lock) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-gray-500">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <p className="mt-4 text-lg font-medium">Lock not found</p>
            <p className="mt-2 text-sm text-gray-600">
              The lock you&apos;re looking for doesn&apos;t exist or has been removed.
            </p>
            <Link
              href="/locks"
              className="mt-4 inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              ← Back to Locks
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-friendly header */}
      <div className="border-b bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <div className="mb-2 flex items-center space-x-2">
              <Link
                href="/locks"
                className="text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                ← Back to Locks
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Lock Details
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {lock.fullPropertyName} • {lock.streetNumber} • Room{" "}
              {lock.lockName}
            </p>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${
                lock.lockId
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {lock.lockId ? "Configured" : "Not Configured"}
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto space-y-6 p-4 sm:p-6">
        {/* Lock Information Card */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b px-4 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Lock Information
            </h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Property Name
                </label>
                <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">
                  {lock.fullPropertyName}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Street Number
                </label>
                <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">
                  {lock.streetNumber}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Room Number
                </label>
                <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">
                  {lock.lockName}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Lock ID
                </label>
                <p className="rounded-md bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900">
                  {lock.lockId ?? "Not set"}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Current Lock Code
                </label>
                <p className="rounded-md bg-gray-50 px-3 py-2 font-mono text-sm text-gray-900">
                  {lock.lockCode ?? "Not set"}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Total Passwords
                </label>
                <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-900">
                  {lock.keyboardPasswords.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Keyboard Passwords */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b px-4 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Keyboard Passwords
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {lock.keyboardPasswords.length > 0
                ? `${lock.keyboardPasswords.length} password(s) configured for this lock`
                : "No passwords configured for this lock"}
            </p>
          </div>

          {lock.keyboardPasswords.length > 0 ? (
            <>
              {/* Mobile: Card layout */}
              <div className="block sm:hidden">
                <div className="divide-y divide-gray-200">
                  {lock.keyboardPasswords.map((password: KeyboardPassword) => (
                    <div key={password.keyboardPwdId} className="p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900">
                            {password.keyboardPwdName}
                          </h3>
                          <p className="mt-1 font-mono text-sm text-gray-600">
                            {password.keyboardPwd}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            password.status === 1
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {password.status === 1 ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">
                            Start Date:
                          </span>
                          <p className="mt-1 text-gray-600">
                            {password.startDate
                              ? new Date(
                                  password.startDate,
                                ).toLocaleDateString()
                              : "Not set"}
                          </p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">
                            End Date:
                          </span>
                          <p className="mt-1 text-gray-600">
                            {password.endDate
                              ? new Date(password.endDate).toLocaleDateString()
                              : "Not set"}
                          </p>
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
                          Password Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                          Password
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                          Start Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                          End Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {lock.keyboardPasswords.map(
                        (password: KeyboardPassword) => (
                          <tr
                            key={password.keyboardPwdId}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {password.keyboardPwdName}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-mono text-sm text-gray-900">
                                {password.keyboardPwd}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                  password.status === 1
                                    ? "bg-green-100 text-green-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {password.status === 1 ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                              {password.startDate
                                ? new Date(password.startDate).toLocaleString()
                                : "Not set"}
                            </td>
                            <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                              {password.endDate
                                ? new Date(password.endDate).toLocaleString()
                                : "Not set"}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center">
              <div className="text-gray-500">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
                <p className="mt-4 text-lg font-medium">
                  No keyboard passwords
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Keyboard passwords will appear here once they&apos;re configured
                  for this lock.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
