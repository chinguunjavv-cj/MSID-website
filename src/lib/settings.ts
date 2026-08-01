import { all, run } from "@/lib/db";
import {
  SETTING_DEFAULTS,
  type SettingKey,
  type SiteSettings,
} from "@/lib/settings-defaults";

/**
 * Site settings the administrator can change without a deploy: contact details, the
 * bank account used for registration payments, social links, and the home hero.
 *
 * Stored as flat key/value rows so adding a setting never needs a migration. The shape
 * and defaults live in `settings-defaults.ts`, which the seed script also reads.
 */

export { SETTING_DEFAULTS };
export type { SettingKey, SiteSettings };

export async function getSettings(): Promise<SiteSettings> {
  const rows = await all<{ key: string; value: string }>(
    "SELECT key, value FROM site_settings",
  );
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { ...SETTING_DEFAULTS, ...stored } as SiteSettings;
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await run(
    `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    key,
    value,
  );
}

export async function setSettings(patch: Partial<SiteSettings>): Promise<void> {
  const entries = Object.entries(patch).filter(([, value]) => value !== undefined);
  await Promise.all(
    entries.map(([key, value]) => setSetting(key as SettingKey, String(value))),
  );
}

/** True once MSID has entered bank details, which gates the transfer instructions. */
export function hasBankDetails(settings: SiteSettings): boolean {
  return Boolean(settings.bank_account_number && settings.bank_account_name);
}
