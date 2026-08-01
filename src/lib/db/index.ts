import { createClient, type Client, type InValue } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { SCHEMA } from "./schema.ts";

/**
 * Database access for the MSID site, over libSQL.
 *
 * libSQL *is* SQLite — same dialect, same schema — but reached over HTTP, which is what
 * makes it work on a serverless host where there is no persistent disk to keep a file
 * on. The same client talks to a local file in development, so `npm run dev` needs no
 * account and no network.
 *
 * Every helper is async. That is not incidental: a serverless database call is a
 * network round trip, and pretending otherwise is how you end up with a synchronous API
 * that cannot be implemented.
 *
 * Connection is chosen by environment:
 *   TURSO_DATABASE_URL + TURSO_AUTH_TOKEN  → hosted Turso (production)
 *   MSID_DB_PATH or the default            → local file (development, Docker volume)
 */

type Param = InValue;

function connectionConfig(): { url: string; authToken?: string } {
  const remote = process.env.TURSO_DATABASE_URL?.trim();
  if (remote) {
    return { url: remote, authToken: process.env.TURSO_AUTH_TOKEN?.trim() };
  }

  const path = process.env.MSID_DB_PATH?.trim() || "./data/msid.db";
  // `file:` URLs are relative to the process working directory.
  return { url: path.startsWith("file:") ? path : `file:${path}` };
}

/**
 * One client and one schema application per process, cached on `globalThis` so Next.js
 * hot reloading does not reconnect on every edit and a warm serverless instance does
 * not re-run the schema on every request.
 */
type GlobalWithDb = typeof globalThis & { __msidDb?: Promise<Client> };

async function connect(): Promise<Client> {
  const config = connectionConfig();

  if (config.url.startsWith("file:")) {
    // The directory has to exist before SQLite will create the file in it.
    const { mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    const filePath = config.url.slice("file:".length);
    mkdirSync(dirname(filePath), { recursive: true });
  }

  const client = createClient(config);

  // `CREATE TABLE IF NOT EXISTS` throughout, so this is safe on every cold start and
  // means a freshly created Turso database comes up working.
  await client.executeMultiple(SCHEMA);

  return client;
}

export function db(): Promise<Client> {
  const globalRef = globalThis as GlobalWithDb;
  if (!globalRef.__msidDb) globalRef.__msidDb = connect();
  return globalRef.__msidDb;
}

/* -------------------------------------------------------------------------- */
/* Query helpers                                                               */
/* -------------------------------------------------------------------------- */

/** libSQL rows are array-like; copy to plain objects so React and JSON behave. */
function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export async function all<T>(sql: string, ...params: Param[]): Promise<T[]> {
  const result = await (await db()).execute({ sql, args: params });
  return result.rows.map((row) => plain<T>(row));
}

export async function get<T>(sql: string, ...params: Param[]): Promise<T | undefined> {
  const result = await (await db()).execute({ sql, args: params });
  return result.rows.length ? plain<T>(result.rows[0]) : undefined;
}

export async function run(sql: string, ...params: Param[]) {
  const result = await (await db()).execute({ sql, args: params });
  return { changes: Number(result.rowsAffected ?? 0) };
}

export async function count(sql: string, ...params: Param[]): Promise<number> {
  const row = await get<{ n: number | bigint }>(sql, ...params);
  return Number(row?.n ?? 0);
}

/* -------------------------------------------------------------------------- */
/* Transactions                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The statement runner handed to a `transaction()` callback.
 *
 * Callbacks must use this rather than the module-level helpers — those take a fresh
 * connection and would run *outside* the transaction, which is the kind of bug that
 * only shows up when a rollback silently fails to undo half the work.
 */
export interface Tx {
  all<T>(sql: string, ...params: Param[]): Promise<T[]>;
  get<T>(sql: string, ...params: Param[]): Promise<T | undefined>;
  run(sql: string, ...params: Param[]): Promise<{ changes: number }>;
}

/** Runs `fn` inside a transaction, rolling back if it throws. */
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await db();
  const tx = await client.transaction("write");

  const runner: Tx = {
    async all<R>(sql: string, ...params: Param[]) {
      const result = await tx.execute({ sql, args: params });
      return result.rows.map((row) => plain<R>(row));
    },
    async get<R>(sql: string, ...params: Param[]) {
      const result = await tx.execute({ sql, args: params });
      return result.rows.length ? plain<R>(result.rows[0]) : undefined;
    },
    async run(sql: string, ...params: Param[]) {
      const result = await tx.execute({ sql, args: params });
      return { changes: Number(result.rowsAffected ?? 0) };
    },
  };

  try {
    const value = await fn(runner);
    await tx.commit();
    return value;
  } catch (error) {
    await tx.rollback().catch(() => {
      // Rollback failure must not mask the original error.
    });
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

/**
 * Appends `-2`, `-3`, … until the slug is free in `table`.
 *
 * Takes a `Tx` because it is only ever called while building a record inside a
 * transaction, and the uniqueness check has to see that transaction's own writes.
 */
export async function uniqueSlug(
  tx: Tx,
  table: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || "item";
  let candidate = root;
  let n = 1;
  // Table name is caller-controlled and never user input.
  while (
    await tx.get<{ id: string }>(
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
