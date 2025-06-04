"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import type { LockProfile, KeyboardPassword } from "@prisma/client";

interface LockDetailResponse {
  lock: LockProfile & {
    keyboardPasswords: KeyboardPassword[];
  };
}

function isLockDetailResponse(data: unknown): data is LockDetailResponse {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as { lock?: unknown };
  if (!obj.lock || typeof obj.lock !== "object" || obj.lock === null) return false;
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
        const response = await fetch(`/api/locks/${encodeURIComponent(String(params.id))}`);
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
    return <div className="p-4">Loading...</div>;
  }

  if (!lock) {
    return <div className="p-4">Lock not found</div>;
  }

  return (
    <div className="p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4">Lock Details</h1>
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600">Property Name</p>
              <p className="font-semibold">{lock.fullPropertyName}</p>
            </div>
            <div>
              <p className="text-gray-600">Street Number</p>
              <p className="font-semibold">{lock.streetNumber}</p>
            </div>
            <div>
              <p className="text-gray-600">Room Number</p>
              <p className="font-semibold">{lock.lockName}</p>
            </div>
            <div>
              <p className="text-gray-600">Lock ID</p>
              <p className="font-semibold">{lock.lockId ?? "-"}</p>
            </div>
            <div>
              <p className="text-gray-600">Current Lock Code</p>
              <p className="font-semibold">{lock.lockCode ?? "-"}</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold mb-4">Keyboard Passwords</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead>
              <tr className="bg-gray-100">
                <th className="px-4 py-2 border">Password Name</th>
                <th className="px-4 py-2 border">Password</th>
                <th className="px-4 py-2 border">Status</th>
                <th className="px-4 py-2 border">Start Date</th>
                <th className="px-4 py-2 border">End Date</th>
              </tr>
            </thead>
            <tbody>
              {lock.keyboardPasswords.map((password: KeyboardPassword) => (
                <tr key={password.keyboardPwdId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">{password.keyboardPwdName}</td>
                  <td className="px-4 py-2 border">{password.keyboardPwd}</td>
                  <td className="px-4 py-2 border">
                    {password.status === 1 ? (
                      <span className="text-green-600">Active</span>
                    ) : (
                      <span className="text-red-600">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-2 border">
                    {password.startDate
                      ? new Date(password.startDate).toLocaleString()
                      : "-"}
                  </td>
                  <td className="px-4 py-2 border">
                    {password.endDate
                      ? new Date(password.endDate).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 