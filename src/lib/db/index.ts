import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { SCHEMA } from "./schema.ts";

/**
 * Database access for the MSID site.
 *
 * Uses Node's built-in `node:sqlite` — no ORM, no code generation, no native build
 * step. The whole database is one file, which makes deployment and backup trivial:
 * copy `data/msid.db` and you have the site.
 *
 * The schema lives in `schema.sql` and is applied on first touch. It is written with
 * `CREATE TABLE IF NOT EXISTS`, so re-running it is safe and additive migrations can be
 * appended to `MIGRATIONS` below.
 */

// `turbopackIgnore` keeps the build tracer from following this `process.cwd()` call
// and pulling the whole project into the output. The path is a fixed literal, or
// `MSID_DB_PATH` in production.
const DB_PATH =
  process.env.MSID_DB_PATH ??
  join(/* turbopackIgnore: true */ process.cwd(), "data", "msid.db");

/**
 * Ordered, idempotent migrations applied after the base schema. Add new entries to the
 * end; never edit or reorder an entry that has shipped. Each runs inside a transaction
 * and is recorded in `_migrations`.
 */
const MIGRATIONS: { id: string; sql: string }[] = [];

type GlobalWithDb = typeof globalThis & { __msidDb?: DatabaseSync };

function open(): DatabaseSync {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const database = new DatabaseSync(DB_PATH);

  database.exec(SCHEMA);
  database.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
       id TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
  );

  const seen = new Set(
    (database.prepare("SELECT id FROM _migrations").all() as { id: string }[]).map(
      (row) => row.id,
    ),
  );

  for (const migration of MIGRATIONS) {
    if (seen.has(migration.id)) continue;
    database.exec("BEGIN");
    try {
      database.exec(migration.sql);
      database.prepare("INSERT INTO _migrations (id) VALUES (?)").run(migration.id);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw new Error(`Migration ${migration.id} failed: ${(error as Error).message}`);
    }
  }

  return database;
}

/**
 * One connection per process, cached on `globalThis` so Next.js hot reloading in
 * development does not open a new handle on every edit.
 */
export function db(): DatabaseSync {
  const globalRef = globalThis as GlobalWithDb;
  if (!globalRef.__msidDb) globalRef.__msidDb = open();
  return globalRef.__msidDb;
}

/* -------------------------------------------------------------------------- */
/* Query helpers                                                               */
/* -------------------------------------------------------------------------- */

type Param = string | number | bigint | null | Uint8Array;

/** SQLite returns null-prototype objects; copy them so React and JSON behave. */
function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export function all<T>(sql: string, ...params: Param[]): T[] {
  return db()
    .prepare(sql)
    .all(...params)
    .map((row) => plain<T>(row));
}

export function get<T>(sql: string, ...params: Param[]): T | undefined {
  const row = db()
    .prepare(sql)
    .get(...params);
  return row === undefined ? undefined : plain<T>(row);
}

export function run(sql: string, ...params: Param[]) {
  return db()
    .prepare(sql)
    .run(...params);
}

export function count(sql: string, ...params: Param[]): number {
  const row = get<{ n: number }>(sql, ...params);
  return Number(row?.n ?? 0);
}

/** Runs `fn` inside a transaction, rolling back if it throws. */
export function transaction<T>(fn: () => T): T {
  const database = db();
  database.exec("BEGIN");
  try {
    const result = fn();
    database.exec("COMMIT");
    return result;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export const newId = (): string => randomUUID();

export const now = (): string => new Date().toISOString().slice(0, 19).replace("T", " ");

/**
 * Builds a parameterised `UPDATE ... SET` clause from a partial record, skipping
 * `undefined` values so callers can pass sparse patches safely.
 */
export function setClause(patch: Record<string, Param | undefined>): {
  sql: string;
  params: Param[];
} {
  const keys = Object.keys(patch).filter((key) => patch[key] !== undefined);
  return {
    sql: keys.map((key) => `${key} = ?`).join(", "),
    params: keys.map((key) => patch[key] as Param),
  };
}

/** URL-safe slug that keeps Mongolian Cyrillic readable by transliterating it. */
const CYRILLIC_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i",
  й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", ө: "u", п: "p", р: "r", с: "s",
  т: "t", у: "u", ү: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sh",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((char) => CYRILLIC_MAP[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Appends `-2`, `-3`, … until the slug is free in `table`. */
export function uniqueSlug(table: string, base: string, excludeId?: string): string {
  const root = slugify(base) || "item";
  let candidate = root;
  let n = 1;
  // Table name is caller-controlled and never user input.
  while (
    get<{ id: string }>(
      `SELECT id FROM ${table} WHERE slug = ? AND id IS NOT ?`,
      candidate,
      excludeId ?? null,
    )
  ) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}
