/**
 * Copies the whole database into another, empty libSQL database.
 *
 *   npm run db:copy                # schema and every row; the target must be empty
 *   npm run db:copy -- --top-up    # afterwards: rows the old database gained since
 *
 * Source: TURSO_DATABASE_URL / TURSO_AUTH_TOKEN — the database the site uses now.
 * Target: NEW_TURSO_DATABASE_URL / NEW_TURSO_AUTH_TOKEN.
 *
 * Written to move production from North America to Tokyo (September 2026). Turso cannot
 * change a database's region, so moving one means a new database and a copy. The site
 * keeps writing to the old database until its settings are switched and it redeploys;
 * `--top-up`, run after that, carries across anything written in between. Every table
 * has a primary key, so a row already copied is skipped rather than duplicated. A row
 * *edited* in that window keeps its earlier version — the window is minutes long.
 *
 * Deliberately does not go through `db()`: that runs the schema and bootstraps an admin
 * on connect, and the target must receive the source's schema exactly — including
 * `_migrations`, so the app finds nothing left to apply. The source is only ever read.
 */

import { createClient, type Client, type InStatement } from "@libsql/client";

const topUp = process.argv.includes("--top-up");

function connect(prefix: "" | "NEW_"): { client: Client; host: string } {
  const url = process.env[`${prefix}TURSO_DATABASE_URL`]?.trim();
  const authToken = process.env[`${prefix}TURSO_AUTH_TOKEN`]?.trim();
  if (!url) {
    console.error(`${prefix}TURSO_DATABASE_URL is not set.`);
    process.exit(1);
  }
  const host = url.startsWith("file:") ? url : new URL(url.replace(/^libsql:/, "https:")).host;
  return { client: createClient({ url, authToken }), host };
}

const source = connect("");
const target = connect("NEW_");
if (source.host === target.host) {
  console.error("The source and the target are the same database. Nothing copied.");
  process.exit(1);
}
console.log(`From ${source.host}\n  to ${target.host}\n`);

interface Master {
  type: string;
  name: string;
  sql: string;
}

/** Tables, indexes and triggers the app created — not SQLite's or libSQL's own. */
async function objects(client: Client): Promise<Master[]> {
  const { rows } = await client.execute(
    `SELECT type, name, sql FROM sqlite_master
     WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'libsql_%'
     ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END, name`,
  );
  return rows as unknown as Master[];
}

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function count(client: Client, table: string): Promise<number> {
  const { rows } = await client.execute(`SELECT COUNT(*) AS n FROM ${quote(table)}`);
  return Number(rows[0].n);
}

async function inserts(table: string, verb: "INSERT" | "INSERT OR IGNORE"): Promise<InStatement[]> {
  const { rows, columns } = await source.client.execute(`SELECT * FROM ${quote(table)}`);
  const list = columns.map(quote).join(", ");
  const marks = columns.map(() => "?").join(", ");
  return rows.map((row) => ({
    sql: `${verb} INTO ${quote(table)} (${list}) VALUES (${marks})`,
    args: columns.map((column) => row[column] ?? null),
  }));
}

const sourceObjects = await objects(source.client);
const tables = sourceObjects.filter((o) => o.type === "table");

if (!topUp) {
  const existing = (await objects(target.client)).filter((o) => o.type === "table");
  if (existing.length > 0) {
    console.error(
      `The target already has ${existing.length} tables. A first copy needs an empty database;\n` +
        "to carry across rows written since the copy, run with --top-up.",
    );
    process.exit(1);
  }

  /*
    One transaction: the target is either a complete copy or untouched. Foreign keys are
    checked at commit rather than per row, so the order tables are filled in is free.
  */
  const statements: InStatement[] = ["PRAGMA defer_foreign_keys = ON"];
  for (const table of tables) statements.push(table.sql);
  for (const table of tables) statements.push(...(await inserts(table.name, "INSERT")));
  for (const other of sourceObjects.filter((o) => o.type !== "table")) statements.push(other.sql);
  await target.client.batch(statements, "write");
} else {
  const statements: InStatement[] = ["PRAGMA defer_foreign_keys = ON"];
  for (const table of tables) statements.push(...(await inserts(table.name, "INSERT OR IGNORE")));
  const before = new Map<string, number>();
  for (const table of tables) before.set(table.name, await count(target.client, table.name));
  await target.client.batch(statements, "write");
  let added = 0;
  for (const table of tables) {
    const gained = (await count(target.client, table.name)) - (before.get(table.name) ?? 0);
    if (gained > 0) console.log(`  ${table.name}: ${gained} new rows carried across`);
    added += gained;
  }
  console.log(added ? "" : "  Nothing new since the copy.");
}

/* Row counts, table by table. The target may be ahead after a top-up, never behind. */
let problems = 0;
for (const table of tables) {
  const from = await count(source.client, table.name);
  const to = await count(target.client, table.name);
  const ok = topUp ? to >= from : to === from;
  if (!ok) problems += 1;
  console.log(`  ${ok ? "ok      " : "MISMATCH"}  ${table.name.padEnd(22)} ${from} → ${to}`);
}

if (problems) {
  console.error(`\n${problems} tables do not match. Do not switch the site to the new database.`);
  process.exit(1);
}
console.log(
  topUp
    ? "\nTop-up complete."
    : `\nCopied ${tables.length} tables. The new database is ready to switch to.`,
);
process.exit(0);
