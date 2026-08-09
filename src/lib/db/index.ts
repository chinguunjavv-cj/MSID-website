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

/**
 * Storage settings that only mean anything for a local SQLite file.
 *
 * A hosted libSQL server manages its own durability and rejects these, so sending them
 * to Turso throws — and because the schema runs on connection, that failure surfaces as
 * every single page returning a 500.
 */
const LOCAL_PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
`;

/**
 * Ordered, additive migrations applied after the base schema.
 *
 * `schema.ts` is all `CREATE TABLE IF NOT EXISTS`, which does nothing to a table that
 * already exists — so a new column on a live database has to arrive as an `ALTER TABLE`
 * here. Append only; never edit or reorder an entry that has shipped, because applied
 * ids are recorded and skipped.
 */
const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "2026-08-01-video-url",
    sql: `
      ALTER TABLE events ADD COLUMN video_url TEXT NOT NULL DEFAULT '';
      ALTER TABLE news_posts ADD COLUMN video_url TEXT NOT NULL DEFAULT '';
    `,
  },
  {
    id: "2026-08-01-login-attempts",
    sql: `
      CREATE TABLE IF NOT EXISTS login_attempts (
        id           TEXT PRIMARY KEY,
        identity     TEXT NOT NULL,
        attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(identity, attempted_at);
    `,
  },
  {
    id: "2026-08-02-password-resets",
    sql: `
      CREATE TABLE IF NOT EXISTS password_resets (
        token_hash TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        used_at    TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
    `,
  },
  {
    /*
      Photographs belong to the event they document, not to a gallery of their own.
      Attached this way each one inherits that event's date, place and name, so a
      caption never has to assert something nobody can verify — which is the whole
      difficulty with the Society's photographs.
    */
    id: "2026-08-05-event-photos",
    sql: `
      CREATE TABLE IF NOT EXISTS event_photos (
        id         TEXT PRIMARY KEY,
        event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        image      TEXT NOT NULL DEFAULT '',
        alt_mn     TEXT NOT NULL DEFAULT '',
        alt_en     TEXT NOT NULL DEFAULT '',
        caption_mn TEXT NOT NULL DEFAULT '',
        caption_en TEXT NOT NULL DEFAULT '',
        sort       INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_event_photos_event ON event_photos(event_id, sort);
    `,
  },
  {
    /*
      A photograph for the fixed prose pages. "Эрхэм зорилго, алсын хараа" and its
      siblings are a heading and four paragraphs, and the Society has photographs of
      the work those paragraphs describe; this puts one under the text without giving
      the admin a page builder to misuse. Optional everywhere — a page with no image
      renders exactly as it does now.
    */
    id: "2026-08-09-page-image",
    sql: `
      ALTER TABLE pages ADD COLUMN image TEXT NOT NULL DEFAULT '';
      ALTER TABLE pages ADD COLUMN image_alt_mn TEXT NOT NULL DEFAULT '';
      ALTER TABLE pages ADD COLUMN image_alt_en TEXT NOT NULL DEFAULT '';
    `,
  },
];

async function applyMigrations(client: Client): Promise<void> {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (
       id TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
  );

  const applied = new Set(
    (await client.execute("SELECT id FROM _migrations")).rows.map((row) =>
      String(row.id),
    ),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    try {
      await client.executeMultiple(migration.sql);
      await client.execute({
        sql: "INSERT INTO _migrations (id) VALUES (?)",
        args: [migration.id],
      });
      console.log(`Applied migration ${migration.id}`);
    } catch (error) {
      /*
        A column that already exists means a previous run applied the change but did not
        record it — recoverable, so record it and move on. Anything else is a real
        failure and must not be hidden.
      */
      if (/duplicate column name/i.test((error as Error).message ?? "")) {
        await client.execute({
          sql: "INSERT OR IGNORE INTO _migrations (id) VALUES (?)",
          args: [migration.id],
        });
        continue;
      }
      throw error;
    }
  }
}

async function connect(): Promise<Client> {
  const config = connectionConfig();
  const isLocalFile = config.url.startsWith("file:");

  if (isLocalFile) {
    // The directory has to exist before SQLite will create the file in it.
    const { mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    const filePath = config.url.slice("file:".length);
    mkdirSync(dirname(filePath), { recursive: true });
  }

  const client = createClient(config);

  if (isLocalFile) await client.executeMultiple(LOCAL_PRAGMAS);

  // `CREATE TABLE IF NOT EXISTS` throughout, so this is safe on every cold start and
  // means a freshly created Turso database comes up working.
  await client.executeMultiple(SCHEMA);
  await applyMigrations(client);

  /*
    Seed on first connection.

    A serverless host has no entrypoint to run `npm run seed` from, and Vercel's
    `env pull` replaces encrypted values with the literal string `[SENSITIVE]`, so the
    credentials to seed remotely cannot be obtained either. Without this, a Vercel
    deployment comes up with empty tables: no administrator to sign in as, no partner
    societies, no page content.

    `seedDatabase` is idempotent and returns early once content exists, so the steady
    -state cost is one `COUNT(*)` per cold start. A failure here must not take the site
    down — an empty site that renders is better than one that 500s — so it is logged
    and swallowed.
  */
  try {
    const { seedDatabase } = await import("./seed-data.ts");
    const result = await runTransaction(client, (tx) => seedDatabase(tx));
    if (result.seededContent) console.log("Database seeded with first-run content.");
    if (result.createdAdmin) console.log(`Administrator created: ${result.createdAdmin}`);
  } catch (error) {
    console.error("Seeding on first connection failed", error);
  }

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
  return runTransaction(await db(), fn);
}

/**
 * The same, against a client passed in explicitly.
 *
 * Seeding runs *inside* `connect()`, before the cached connection promise has settled.
 * Going through `db()` there would re-enter `connect()` and wait on a promise that
 * cannot resolve until the seeding it is waiting for completes.
 */
export async function runTransaction<T>(
  client: Client,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
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
