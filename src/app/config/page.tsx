"use client";

import { useState, useEffect } from "react";

interface ConfigValues {
  DUVE_CSRF_TOKEN?: string;
  DUVE_SESSION_ID?: string;
  DUVE_COOKIE?: string;
  SIFELY_AUTH_TOKEN?: string;
}

type ConfigDescriptions = Record<string, string>;

interface ConfigApiResponse {
  success: boolean;
  data?: {
    values: ConfigValues;
    descriptions: ConfigDescriptions;
  };
  error?: string;
}

export default function ConfigPage() {
  const [values, setValues] = useState<ConfigValues>({});
  const [descriptions, setDescriptions] = useState<ConfigDescriptions>({
    DUVE_CSRF_TOKEN: "CSRF token for Duve API authentication",
    DUVE_SESSION_ID: "Session ID for Duve API authentication",
    DUVE_COOKIE: "Cookie value for Duve API authentication",
    SIFELY_AUTH_TOKEN: "Authorization token for Sifely API",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    void fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/config");

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as ConfigApiResponse;

      if (data.success && data.data) {
        setValues(data.data.values);
        setDescriptions(data.data.descriptions);
        setMessage({
          type: "success",
          text: "Configuration loaded successfully",
        });
      } else {
        setMessage({
          type: "error",
          text: data.error ?? "Failed to fetch configuration",
        });
      }
    } catch (error) {
      console.error("Error fetching configuration:", error);
      setMessage({
        type: "error",
        text: `Failed to fetch configuration: ${error instanceof Error ? error.message : "Unknown error"}. You can still enter values manually.`,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch("/api/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values }),
      });

      const data = (await response.json()) as ConfigApiResponse;

      if (data.success) {
        setMessage({
          type: "success",
          text: "Configuration saved successfully!",
        });
      } else {
        setMessage({
          type: "error",
          text: data.error ?? "Failed to save configuration",
        });
      }
    } catch (_error) {
      setMessage({ type: "error", text: "Failed to save configuration" });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading configuration...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-2xl px-4">
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="mb-6">
            <h1 className="mb-2 text-2xl font-bold text-gray-900">
              Configuration Management
            </h1>
            <p className="text-gray-600">
              Manage your API tokens and credentials. These values will be
              stored securely in the database.
            </p>
          </div>

          {message && (
            <div
              className={`mb-6 rounded-md p-4 ${
                message.type === "success"
                  ? "border border-green-200 bg-green-50 text-green-800"
                  : "border border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="space-y-6">
            {Object.entries(descriptions).map(([key, description]) => (
              <div key={key} className="space-y-2">
                <label
                  htmlFor={key}
                  className="block text-sm font-medium text-gray-700"
                >
                  {key}
                </label>
                <p className="text-sm text-gray-500">{description}</p>
                <input
                  id={key}
                  type="password"
                  value={values[key as keyof ConfigValues] ?? ""}
                  onChange={(e) => handleInputChange(key, e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder={`Enter ${key}`}
                />
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-end space-x-3">
            <button
              onClick={fetchConfig}
              disabled={loading}
              className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 focus:ring-2 focus:ring-gray-500 focus:outline-none disabled:opacity-50"
            >
              Reset
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Configuration"}
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Usage Instructions
          </h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>
              • <strong>DUVE_CSRF_TOKEN:</strong> Required for authenticating
              with the Duve API
            </li>
            <li>
              • <strong>DUVE_SESSION_ID:</strong> Session identifier for Duve
              API calls
            </li>
            <li>
              • <strong>DUVE_COOKIE:</strong> Cookie value needed for Duve API
              authentication
            </li>
            <li>
              • <strong>SIFELY_AUTH_TOKEN:</strong> Authorization token for
              Sifely lock management
            </li>
          </ul>
          <p className="mt-4 text-sm text-gray-500">
            These values are stored securely in the database and will be used by
            the application instead of environment variables.
          </p>
        </div>
      </div>
    </div>
  );
}
