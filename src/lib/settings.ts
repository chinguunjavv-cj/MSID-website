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

export function getSettings(): SiteSettings {
  const rows = all<{ key: string; value: string }>("SELECT key, value FROM site_settings");
  const stored = Object.fromEntries(rows.map((row) => [row.key, row.value]));
  return { ...SETTING_DEFAULTS, ...stored } as SiteSettings;
}

export function setSetting(key: SettingKey, value: string): void {
  run(
    `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    key,
    value,
  );
}

export function setSettings(patch: Partial<SiteSettings>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) setSetting(key as SettingKey, String(value));
  }
}

/** True once MSID has entered bank details, which gates the transfer instructions. */
export function hasBankDetails(settings: SiteSettings): boolean {
  return Boolean(settings.bank_account_number && settings.bank_account_name);
}
