"use client";

import { useState, useEffect } from "react";
import type { LockProfile } from "@prisma/client";

interface PaginationInfo {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
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

  useEffect(() => {
    fetchLocks(pagination.page);
  }, [pagination.page]);

  const fetchLocks = async (page: number) => {
    try {
      const response = await fetch(
        `/api/locks?page=${page}&pageSize=${pagination.pageSize}`,
      );
      const data = await response.json();
      setLocks(data.locks);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching locks:", error);
    } finally {
      setLoading(false);
    }
  };

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

  const handlePageChange = (newPage: number) => {
    setPagination((prev) => ({ ...prev, page: newPage }));
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lock Profiles</h1>
        <div className="text-gray-600">Total Locks: {pagination.total}</div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200 bg-white">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-4 py-2">Property Name</th>
              <th className="border px-4 py-2">Street Number</th>
              <th className="border px-4 py-2">Room Number</th>
              <th className="border px-4 py-2">Lock ID</th>
              <th className="border px-4 py-2">Lock Code</th>
              <th className="border px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {locks.map((lock) => (
              <tr key={lock.id} className="hover:bg-gray-50">
                {editingLock?.id === lock.id ? (
                  <>
                    <td className="border px-4 py-2">
                      <input
                        type="text"
                        value={editingLock.fullPropertyName}
                        onChange={(e) =>
                          setEditingLock({
                            ...editingLock,
                            fullPropertyName: e.target.value,
                          })
                        }
                        className="w-full rounded border p-1"
                      />
                    </td>
                    <td className="border px-4 py-2">{lock.streetNumber}</td>
                    <td className="border px-4 py-2">{lock.roomNumber}</td>
                    <td className="border px-4 py-2">
                      <input
                        type="text"
                        value={editingLock.lockId || ""}
                        onChange={(e) =>
                          setEditingLock({
                            ...editingLock,
                            lockId: e.target.value,
                          })
                        }
                        className="w-full rounded border p-1"
                      />
                    </td>
                    <td className="border px-4 py-2">
                      <input
                        type="text"
                        value={editingLock.lockCode || ""}
                        onChange={(e) =>
                          setEditingLock({
                            ...editingLock,
                            lockCode: e.target.value,
                          })
                        }
                        className="w-full rounded border p-1"
                        placeholder="#1234"
                      />
                    </td>
                    <td className="border px-4 py-2">
                      <button
                        onClick={handleSave}
                        className="mr-2 rounded bg-green-500 px-2 py-1 text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="rounded bg-gray-500 px-2 py-1 text-white"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="border px-4 py-2">
                      {lock.fullPropertyName}
                    </td>
                    <td className="border px-4 py-2">{lock.streetNumber}</td>
                    <td className="border px-4 py-2">{lock.roomNumber}</td>
                    <td className="border px-4 py-2">{lock.lockId || "-"}</td>
                    <td className="border px-4 py-2">{lock.lockCode || "-"}</td>
                    <td className="border px-4 py-2">
                      <button
                        onClick={() => handleEdit(lock)}
                        className="rounded bg-blue-500 px-2 py-1 text-white"
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
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Showing {(pagination.page - 1) * pagination.pageSize + 1} to{" "}
          {Math.min(pagination.page * pagination.pageSize, pagination.total)} of{" "}
          {pagination.total} locks
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-3 py-1">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
