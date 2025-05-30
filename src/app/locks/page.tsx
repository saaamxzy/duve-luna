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
        const response = await fetch('/api/locks');
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
        const updatedResponse = await fetch('/api/locks');
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
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Lock Profiles</h1>
        <div className="text-gray-600">
          Total Locks: {locks.length}
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
                    <td className="px-4 py-2 border">{lock.lockName}</td>
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
                    <td className="px-4 py-2 border">{lock.lockName}</td>
                    <td className="px-4 py-2 border">
                      {lock.lockId ? (
                        <Link
                          href={`/locks/${lock.id}`}
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {lock.lockId}
                        </Link>
                      ) : (
                        "-"
                      )}
                    </td>
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
    </div>
  );
}
