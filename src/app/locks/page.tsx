"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { LockProfile } from "@prisma/client";

interface LocksApiResponse {
  locks: LockProfile[];
}

function isLocksApiResponse(data: unknown): data is LocksApiResponse {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return Array.isArray(obj.locks);
}

export default function LocksPage() {
  const [locks, setLocks] = useState<LockProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLock, setEditingLock] = useState<LockProfile | null>(null);

  useEffect(() => {
    const fetchLocks = async () => {
      try {
        const response = await fetch("/api/locks");
        const data: unknown = await response.json();
        if (isLocksApiResponse(data)) {
          setLocks(data.locks ?? []);
        } else {
          throw new Error("Invalid API response");
        }
      } catch (error) {
        console.error("Error fetching locks:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchLocks();
  }, []);

  const handleEdit = (lock: LockProfile) => {
    setEditingLock(lock);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLock) return;

    try {
      const response = await fetch(`/api/locks/${editingLock.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editingLock),
      });

      if (response.ok) {
        const updatedResponse = await fetch("/api/locks");
        const data: unknown = await updatedResponse.json();
        if (isLocksApiResponse(data)) {
          setLocks(data.locks ?? []);
        }
        setEditingLock(null);
      }
    } catch (error) {
      console.error("Error updating lock:", error);
    }
  };

  const handleCancel = () => {
    setEditingLock(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading locks...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile-friendly header */}
      <div className="border-b bg-white px-4 py-4 shadow-sm sm:px-6">
        <div className="flex flex-col space-y-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
              Lock Profiles
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage your lock configurations and view lock details
            </p>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <span className="rounded-full bg-blue-100 px-2 py-1 text-blue-800">
              Total Locks: {locks.length}
            </span>
          </div>
        </div>
      </div>

      <div className="container mx-auto p-4 sm:p-6">
        <div className="rounded-lg border bg-white shadow-sm">
          {/* Mobile: Card layout */}
          <div className="block sm:hidden">
            <div className="divide-y divide-gray-200">
              {locks.map((lock) => (
                <div key={lock.id} className="p-4">
                  {editingLock?.id === lock.id ? (
                    <div className="space-y-4">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Property Name
                        </label>
                        <input
                          type="text"
                          value={editingLock.fullPropertyName}
                          onChange={(e) =>
                            setEditingLock({
                              ...editingLock,
                              fullPropertyName: e.target.value,
                            })
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            Street Number
                          </label>
                          <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-600">
                            {lock.streetNumber}
                          </p>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            Room Number
                          </label>
                          <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-600">
                            {lock.lockName}
                          </p>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Lock ID
                        </label>
                        <input
                          type="text"
                          value={editingLock.lockId ?? ""}
                          onChange={(e) =>
                            setEditingLock({
                              ...editingLock,
                              lockId: e.target.value,
                            })
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Lock Code
                        </label>
                        <input
                          type="text"
                          value={editingLock.lockCode ?? ""}
                          onChange={(e) =>
                            setEditingLock({
                              ...editingLock,
                              lockCode: e.target.value,
                            })
                          }
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                          placeholder="#1234"
                        />
                      </div>
                      <div className="flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
                        <button
                          onClick={handleSave}
                          className="w-full rounded-md bg-green-500 px-4 py-2 text-white transition-colors hover:bg-green-600 sm:w-auto"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          className="w-full rounded-md bg-gray-500 px-4 py-2 text-white transition-colors hover:bg-gray-600 sm:w-auto"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-gray-900">
                            {lock.fullPropertyName}
                          </h3>
                          <p className="mt-1 text-sm text-gray-600">
                            {lock.streetNumber} • Room {lock.lockName}
                          </p>
                        </div>
                        <button
                          onClick={() => handleEdit(lock)}
                          className="rounded-md bg-blue-500 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-600"
                        >
                          Edit
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">
                            Lock ID:
                          </span>
                          <div className="mt-1">
                            {lock.lockId ? (
                              <Link
                                href={`/locks/${lock.id}`}
                                className="font-mono text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {lock.lockId}
                              </Link>
                            ) : (
                              <span className="text-gray-400">Not set</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">
                            Lock Code:
                          </span>
                          <div className="mt-1">
                            {lock.lockCode ? (
                              <span className="font-mono text-gray-900">
                                {lock.lockCode}
                              </span>
                            ) : (
                              <span className="text-gray-400">Not set</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
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
                      Property Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Street Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Room Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Lock ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Lock Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {locks.map((lock) => (
                    <tr key={lock.id} className="hover:bg-gray-50">
                      {editingLock?.id === lock.id ? (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="text"
                              value={editingLock.fullPropertyName}
                              onChange={(e) =>
                                setEditingLock({
                                  ...editingLock,
                                  fullPropertyName: e.target.value,
                                })
                              }
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                            {lock.streetNumber}
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                            {lock.lockName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="text"
                              value={editingLock.lockId ?? ""}
                              onChange={(e) =>
                                setEditingLock({
                                  ...editingLock,
                                  lockId: e.target.value,
                                })
                              }
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <input
                              type="text"
                              value={editingLock.lockCode ?? ""}
                              onChange={(e) =>
                                setEditingLock({
                                  ...editingLock,
                                  lockCode: e.target.value,
                                })
                              }
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              placeholder="#1234"
                            />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex space-x-2">
                              <button
                                onClick={handleSave}
                                className="rounded-md bg-green-500 px-3 py-1 text-sm text-white transition-colors hover:bg-green-600"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancel}
                                className="rounded-md bg-gray-500 px-3 py-1 text-sm text-white transition-colors hover:bg-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {lock.fullPropertyName}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                            {lock.streetNumber}
                          </td>
                          <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                            {lock.lockName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {lock.lockId ? (
                              <Link
                                href={`/locks/${lock.id}`}
                                className="font-mono text-sm text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {lock.lockId}
                              </Link>
                            ) : (
                              <span className="text-sm text-gray-400">
                                Not set
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {lock.lockCode ? (
                              <span className="font-mono text-sm text-gray-900">
                                {lock.lockCode}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400">
                                Not set
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleEdit(lock)}
                              className="rounded-md bg-blue-500 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-600"
                            >
                              Edit
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Empty state */}
          {locks.length === 0 && (
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
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <p className="mt-4 text-lg font-medium">No locks found</p>
                <p className="mt-2 text-sm text-gray-600">
                  Lock profiles will appear here once they&apos;re created.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
