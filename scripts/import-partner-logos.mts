/**
 * Put the partner logos into storage and point the partner records at them.
 *
 *   node --env-file=.env.production.local scripts/import-partner-logos.mts
 *
 * The artwork is committed under `public/brand/`, but production serves from Vercel
 * Blob: the site's own upload path stores absolute Blob URLs, and going through Blob
 * means the logos can appear on the live site without waiting for a deploy to carry
 * the files. The derived PNGs stay in the repo as the source of truth.
 *
 * Idempotent. Run it again after replacing a logo and it overwrites in place — the
 * Blob pathname is stable, so the stored URL does not change.
 */

import { readFile } from "node:fs/promises";
import { db, run, all } from "../src/lib/db/index.ts";

const LOGOS: { acronym: string; file: string }[] = [
  { acronym: "KASID", file: "partner-kasid.png" },
  { acronym: "AOCC", file: "partner-aocc.png" },
  { acronym: "ECCO", file: "partner-ecco.png" },
];

await db();

const token = process.env.BLOB_READ_WRITE_TOKEN;
if (!token) {
  console.error(
    "BLOB_READ_WRITE_TOKEN is not set. Run this with the production env file:\n" +
      "  node --env-file=.env.production.local scripts/import-partner-logos.mts",
  );
  process.exit(1);
}

const { put } = await import("@vercel/blob");

for (const { acronym, file } of LOGOS) {
  const body = await readFile(new URL(`../public/brand/${file}`, import.meta.url));

  const blob = await put(`brand/${file}`, body, {
    access: "public",
    contentType: "image/png",
    // A stable pathname, so re-running this replaces the logo rather than
    // accumulating a new URL every time.
    addRandomSuffix: false,
    allowOverwrite: true,
    token,
  });

  const result = await run(
    "UPDATE partners SET logo = ? WHERE acronym = ?",
    blob.url,
    acronym,
  );

  console.log(
    result.changes
      ? `${acronym.padEnd(6)} -> ${blob.url}`
      : `${acronym.padEnd(6)} !! uploaded, but no partner row with that acronym`,
  );
}

console.log("\nPartner records now read:");
for (const row of await all<{ acronym: string; logo: string }>(
  "SELECT acronym, logo FROM partners ORDER BY sort",
)) {
  console.log(`  ${row.acronym.padEnd(6)} ${row.logo || "(none)"}`);
}
