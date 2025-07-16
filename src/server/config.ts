import { db } from "./db";

export type ConfigKey =
  | "DUVE_CSRF_TOKEN"
  | "DUVE_SESSION_ID"
  | "DUVE_COOKIE"
  | "SIFELY_AUTH_TOKEN";

export interface ConfigValues {
  DUVE_CSRF_TOKEN?: string;
  DUVE_SESSION_ID?: string;
  DUVE_COOKIE?: string;
  SIFELY_AUTH_TOKEN?: string;
}

const CONFIG_DESCRIPTIONS = {
  DUVE_CSRF_TOKEN: "CSRF token for Duve API authentication",
  DUVE_SESSION_ID: "Session ID for Duve API authentication",
  DUVE_COOKIE: "Cookie value for Duve API authentication",
  SIFELY_AUTH_TOKEN: "Authorization token for Sifely API",
};

export class ConfigService {
  /**
   * Get a single configuration value
   */
  static async get(key: ConfigKey): Promise<string | null> {
    const config = await db.configuration.findUnique({
      where: { key },
    });

    return config?.value ?? null;
  }

  /**
   * Get all configuration values
   */
  static async getAll(): Promise<ConfigValues> {
    const configs = await db.configuration.findMany();

    const values: ConfigValues = {};
    for (const config of configs) {
      if (config.key in CONFIG_DESCRIPTIONS) {
        values[config.key as ConfigKey] = config.value ?? undefined;
      }
    }

    return values;
  }

  /**
   * Set a single configuration value
   */
  static async set(key: ConfigKey, value: string): Promise<void> {
    await db.configuration.upsert({
      where: { key },
      update: {
        value,
        updatedAt: new Date(),
      },
      create: {
        key,
        value,
        description: CONFIG_DESCRIPTIONS[key],
      },
    });
  }

  /**
   * Set multiple configuration values
   */
  static async setMultiple(values: ConfigValues): Promise<void> {
    const promises = Object.entries(values)
      .map(([key, value]) => {
        if (value !== undefined && typeof value === "string") {
          return this.set(key as ConfigKey, value);
        }
      })
      .filter(Boolean);

    await Promise.all(promises);
  }

  /**
   * Delete a configuration value
   */
  static async delete(key: ConfigKey): Promise<void> {
    await db.configuration.delete({
      where: { key },
    });
  }

  /**
   * Get all configuration keys with descriptions
   */
  static getConfigDescriptions() {
    return CONFIG_DESCRIPTIONS;
  }
}

// Configuration cache to avoid repeated database queries
const configCache = new Map<string, { value: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

/**
 * Get configuration value with fallback to environment variable
 * Uses caching to avoid repeated database queries
 */
export async function getConfigWithFallback(
  key: string,
): Promise<string | null> {
  const now = Date.now();
  const cached = configCache.get(key);

  // Return cached value if still valid
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.value;
  }

  try {
    const config = await db.configuration.findUnique({
      where: { key },
    });

    const value = config?.value ?? process.env[key] ?? null;

    // Cache the result
    if (value) {
      configCache.set(key, { value, timestamp: now });
    }

    return value;
  } catch (error) {
    console.error(`Error fetching config for key ${key}:`, error);
    return process.env[key] ?? null;
  }
}

/**
 * Clear configuration cache - useful for testing or when config changes
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Pre-warm the configuration cache with commonly used values
 */
export async function prewarmConfigCache(): Promise<void> {
  const commonKeys = ["DUVE_CSRF_TOKEN", "DUVE_COOKIE", "SIFELY_AUTH_TOKEN"];

  console.log("Pre-warming configuration cache...");

  const promises = commonKeys.map((key) =>
    getConfigWithFallback(key).catch((error) => {
      console.warn(`Failed to pre-warm config for ${key}:`, error);
      return null;
    }),
  );

  await Promise.allSettled(promises);
  console.log(
    `Configuration cache pre-warmed with ${configCache.size} entries`,
  );
}

/**
 * Vercel-specific optimizations
 */
export const VERCEL_OPTIMIZATIONS = {
  // Smaller batch sizes for Vercel to avoid memory limits
  BATCH_SIZE: process.env.VERCEL ? 5 : 10,

  // Longer timeouts for API calls on Vercel due to cold starts
  API_TIMEOUT: process.env.VERCEL ? 30000 : 15000,

  // Connection pool settings for Vercel
  DB_CONNECTION_LIMIT: process.env.VERCEL ? 3 : 10,

  // Enable connection pooling optimizations
  USE_CONNECTION_POOLING:
    process.env.VERCEL ?? process.env.NODE_ENV === "production",

  // Cache settings
  ENABLE_CACHING: true,
  CACHE_TTL: process.env.VERCEL ? 10 * 60 * 1000 : 5 * 60 * 1000, // 10 minutes on Vercel

  // Rate limiting for external APIs
  API_RATE_LIMIT_DELAY: process.env.VERCEL ? 200 : 100, // ms between API calls

  // Memory optimization
  ENABLE_MEMORY_OPTIMIZATION: process.env.VERCEL ?? false,
};
