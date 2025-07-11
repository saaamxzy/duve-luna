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
    } catch (error) {
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
        <div className="text-lg text-gray-600">Loading configuration...</div>
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
              Configuration Management
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Manage your API tokens and credentials securely
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto space-y-6 p-4 sm:p-6">
        {/* Status message */}
        {message && (
          <div
            className={`rounded-md p-4 ${
              message.type === "success"
                ? "border border-green-200 bg-green-50 text-green-800"
                : "border border-red-200 bg-red-50 text-red-800"
            }`}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                {message.type === "success" ? (
                  <svg
                    className="h-5 w-5 text-green-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium">{message.text}</p>
              </div>
            </div>
          </div>
        )}

        {/* Configuration Form */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b px-4 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-gray-900">
              API Configuration
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              These values will be stored securely in the database and used by
              the application.
            </p>
          </div>
          <div className="p-4 sm:p-6">
            <div className="space-y-6">
              {Object.entries(descriptions).map(([key, description]) => (
                <div key={key} className="space-y-2">
                  <label
                    htmlFor={key}
                    className="block text-sm font-medium text-gray-700"
                  >
                    {key
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </label>
                  <p className="text-sm text-gray-500">{description}</p>
                  <div className="relative">
                    <input
                      id={key}
                      type="password"
                      value={values[key as keyof ConfigValues] ?? ""}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 pr-10 text-sm shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      placeholder={`Enter ${key.replace(/_/g, " ").toLowerCase()}`}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                      <svg
                        className="h-4 w-4 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-b-lg border-t bg-gray-50 px-4 py-4 sm:px-6">
            <div className="flex flex-col space-y-3 sm:flex-row sm:justify-end sm:space-y-0 sm:space-x-3">
              <button
                onClick={fetchConfig}
                disabled={loading}
                className="order-2 w-full rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 focus:ring-2 focus:ring-gray-500 focus:outline-none disabled:opacity-50 sm:order-1 sm:w-auto"
              >
                Reset
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="order-1 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50 sm:order-2 sm:w-auto"
              >
                {saving ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="mr-2 -ml-1 h-4 w-4 animate-spin text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  "Save Configuration"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="border-b px-4 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-gray-900">
              Usage Instructions
            </h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-blue-50 p-4">
                  <h3 className="mb-2 text-sm font-medium text-blue-900">
                    DUVE Configuration
                  </h3>
                  <ul className="space-y-1 text-sm text-blue-800">
                    <li>
                      • <strong>CSRF Token:</strong> Required for API
                      authentication
                    </li>
                    <li>
                      • <strong>Session ID:</strong> Session identifier for API
                      calls
                    </li>
                    <li>
                      • <strong>Cookie:</strong> Cookie value for authentication
                    </li>
                  </ul>
                </div>
                <div className="rounded-lg bg-green-50 p-4">
                  <h3 className="mb-2 text-sm font-medium text-green-900">
                    SIFELY Configuration
                  </h3>
                  <ul className="space-y-1 text-sm text-green-800">
                    <li>
                      • <strong>Auth Token:</strong> Authorization token for
                      lock management
                    </li>
                    <li>• Used for updating lock codes and managing devices</li>
                  </ul>
                </div>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <h3 className="mb-2 text-sm font-medium text-gray-900">
                  Security Notice
                </h3>
                <p className="text-sm text-gray-700">
                  All credentials are stored securely in the database with
                  encryption. These values will be used by the application
                  instead of environment variables for enhanced security and
                  easier management.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
