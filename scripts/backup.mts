/**
 * Backs up the database to a SQL file, and reports whether foreign keys are enforced.
 *
 *   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run backup
 *   npm run backup                          # local file database, .env.local
 *
 * Writes `backups/msid-YYYY-MM-DD-HHMM.sql` — schema followed by one INSERT per row for
 * every table — which restores into any SQLite or libSQL with `sqlite3 new.db < file`
 * or `turso db shell <name> < file`. Uploaded files are not included: on Vercel Blob
 * they have their own durability, on a volume copy the upload directory alongside.
 *
 * Turso's free plan has no point-in-time restore (AUDIT.md item 6), so until MSID pays
 * for one, this run on a schedule — a weekly reminder is enough at the society's write
 * rate — is the backup. Keep the files somewhere other than the laptop that made them.
 *
 * The foreign-key check answers AUDIT.md item 5 in the same connection the app uses:
 * `PRAGMA foreign_keys` is per connection, and the app only sends `= ON` for a local
 * file. If it prints 0 against Turso, cascades declared in the schema are not firing
 * there and the deletions that rely on them need explicit handling.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { all, db } from "../src/lib/db/index.ts";

await db();

/* ---- Foreign keys ------------------------------------------------------- */

const [fk] = await all<{ foreign_keys: number }>("PRAGMA foreign_keys");
const enforced = fk?.foreign_keys === 1;
console.log(
  enforced
    ? "Foreign keys: enforced on this connection."
    : "Foreign keys: NOT enforced on this connection — schema cascades will not fire here.",
);

/* ---- Dump --------------------------------------------------------------- */

interface Master {
  type: string;
  name: string;
  tbl_name: string;
  sql: string | null;
}

const objects = await all<Master>(
  `SELECT type, name, tbl_name, sql FROM sqlite_master
   WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
   ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name`,
);

function literal(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array || Buffer.isBuffer(value)) {
    return `X'${Buffer.from(value).toString("hex")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

const lines: string[] = [
  `-- MSID database backup, ${new Date().toISOString()}`,
  "PRAGMA foreign_keys = OFF;",
  "BEGIN TRANSACTION;",
];

let rowCount = 0;
for (const object of objects.filter((o) => o.type === "table")) {
  lines.push("", `${object.sql};`);
  const rows = await all<Record<string, unknown>>(`SELECT * FROM "${object.name}"`);
  for (const row of rows) {
    const columns = Object.keys(row);
    lines.push(
      `INSERT INTO "${object.name}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${columns
        .map((c) => literal(row[c]))
        .join(", ")});`,
    );
  }
  rowCount += rows.length;
  console.log(`  ${object.name}: ${rows.length} rows`);
}

for (const object of objects.filter((o) => o.type !== "table")) {
  lines.push(`${object.sql};`);
}
lines.push("COMMIT;", "");

const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
const dir = join(process.cwd(), "backups");
mkdirSync(dir, { recursive: true });
const file = join(dir, `msid-${stamp}.sql`);
writeFileSync(file, lines.join("\n"), "utf8");
console.log(`\nWrote ${file} (${rowCount} rows across ${objects.filter((o) => o.type === "table").length} tables).`);
