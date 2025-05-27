"use client";

import { useState, useEffect, useCallback } from "react";
import type { LockProfile } from "@prisma/client";

interface PaginationInfo {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface LocksApiResponse {
  locks: LockProfile[];
  pagination: PaginationInfo;
}

function isLocksApiResponse(data: unknown): data is LocksApiResponse {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    Array.isArray(obj.locks) &&
    typeof obj.pagination === "object" &&
    obj.pagination !== null
  );
}

async function fetchLocks(page: number, pageSize: number): Promise<LocksApiResponse> {
  const res = await fetch(`/api/locks?page=${page}&pageSize=${pageSize}`);
  if (!res.ok) throw new Error("Failed to fetch locks");
  const data: unknown = await res.json();
  if (!isLocksApiResponse(data)) {
    throw new Error("Invalid API response");
  }
  return data;
}

export default function LocksPage() {
  const [locks, setLocks] = useState<LockProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingLock, setEditingLock] = useState<LockProfile | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    pageSize: 10,
    totalPages: 0,
  });

  const fetchLocks = useCallback(async (page: number) => {
    try {
      const response = await fetch(
        `/api/locks?page=${page}&pageSize=${pagination.pageSize}`,
      );
      const data: unknown = await response.json();
      if (isLocksApiResponse(data)) {
        setLocks(data.locks ?? []);
        setPagination(data.pagination ?? pagination);
      } else {
        throw new Error("Invalid API response");
      }
    } catch (error) {
      console.error("Error fetching locks:", error);
    } finally {
      setLoading(false);
    }
  }, [pagination.pageSize, pagination]);

  useEffect(() => {
    void fetchLocks(pagination.page);
  }, [pagination.page, fetchLocks]);

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
        await fetchLocks(pagination.page);
        setEditingLock(null);
      }
    } catch (error) {
      console.error("Error updating lock:", error);
    }
  };

  const handleCancel = () => {
    setEditingLock(null);
  };

  const handlePageChange = useCallback(
    (newPage: number) => {
      setPagination((prev) => ({ ...prev, page: newPage }));
    },
    [],
  );

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Lock Profiles</h1>
        <div className="text-gray-600">
          Total Locks: {pagination.total}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border">Property Name</th>
              <th className="px-4 py-2 border">Street Number</th>
              <th className="px-4 py-2 border">Room Number</th>
              <th className="px-4 py-2 border">Lock ID</th>
              <th className="px-4 py-2 border">Lock Code</th>
              <th className="px-4 py-2 border">Actions</th>
            </tr>
          </thead>
          <tbody>
            {locks.map((lock) => (
              <tr key={lock.id} className="hover:bg-gray-50">
                {editingLock?.id === lock.id ? (
                  <>
                    <td className="px-4 py-2 border">
                      <input
                        type="text"
                        value={editingLock.fullPropertyName}
                        onChange={(e) =>
                          setEditingLock({
                            ...editingLock,
                            fullPropertyName: e.target.value,
                          })
                        }
                        className="w-full p-1 border rounded"
                      />
                    </td>
                    <td className="px-4 py-2 border">{lock.streetNumber}</td>
                    <td className="px-4 py-2 border">{lock.roomNumber}</td>
                    <td className="px-4 py-2 border">
                      <input
                        type="text"
                        value={editingLock.lockId ?? ""}
                        onChange={(e) =>
                          setEditingLock({
                            ...editingLock,
                            lockId: e.target.value,
                          })
                        }
                        className="w-full p-1 border rounded"
                      />
                    </td>
                    <td className="px-4 py-2 border">
                      <input
                        type="text"
                        value={editingLock.lockCode ?? ""}
                        onChange={(e) =>
                          setEditingLock({
                            ...editingLock,
                            lockCode: e.target.value,
                          })
                        }
                        className="w-full p-1 border rounded"
                        placeholder="#1234"
                      />
                    </td>
                    <td className="px-4 py-2 border">
                      <button
                        onClick={handleSave}
                        className="bg-green-500 text-white px-2 py-1 rounded mr-2"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="bg-gray-500 text-white px-2 py-1 rounded"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2 border">{lock.fullPropertyName}</td>
                    <td className="px-4 py-2 border">{lock.streetNumber}</td>
                    <td className="px-4 py-2 border">{lock.roomNumber}</td>
                    <td className="px-4 py-2 border">{lock.lockId ?? "-"}</td>
                    <td className="px-4 py-2 border">{lock.lockCode ?? "-"}</td>
                    <td className="px-4 py-2 border">
                      <button
                        onClick={() => handleEdit(lock)}
                        className="bg-blue-500 text-white px-2 py-1 rounded"
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

      {/* Pagination Controls */}
      <div className="mt-4 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Showing {((pagination.page - 1) * pagination.pageSize) + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} locks
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-3 py-1">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 py-1 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
