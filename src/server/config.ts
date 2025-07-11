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

/**
 * Helper function to get configuration values with fallback to environment variables
 * This is used during the migration period
 */
export async function getConfigWithFallback(
  key: ConfigKey,
): Promise<string | null> {
  // First try to get from database
  const dbValue = await ConfigService.get(key);
  if (dbValue) {
    return dbValue;
  }

  // Fallback to environment variable
  return process.env[key] ?? null;
}
