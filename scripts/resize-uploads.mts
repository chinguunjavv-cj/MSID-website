/**
 * Shrinks the photographs already in storage, in place.
 *
 *   npm run resize:uploads            # report only, writes nothing
 *   npm run resize:uploads -- --apply # rewrite the oversized ones
 *
 * Needs TURSO_DATABASE_URL, TURSO_AUTH_TOKEN and BLOB_READ_WRITE_TOKEN, so it runs from
 * a terminal that has them — the same way `npm run backup` does.
 *
 * Why this exists: with Vercel's optimiser answering 402 the site serves originals, and
 * an original is whatever a phone camera produced. Eight gallery photographs at a third
 * of a megabyte each is most of the home page's weight, on a site read on hospital wifi.
 * Resized to the largest size the layout ever asks for, they cost a fraction of that and
 * look identical.
 *
 * The blob keeps its pathname, so every row that references it stays correct and nothing
 * in the database has to change. Files already small enough are left alone, which makes
 * the script safe to run twice.
 */

import sharp from "sharp";
import { all, db } from "../src/lib/db/index.ts";

/** The widest any photograph is ever displayed: the gallery lightbox, full-bleed. */
const MAX_WIDTH = 1600;
/** Below this, re-encoding would save little and cost a generation of quality. */
const LEAVE_ALONE_BYTES = 120 * 1024;

const apply = process.argv.includes("--apply");

/** Every column that holds a stored file path. PDFs are skipped by content type. */
const SOURCES: { table: string; column: string }[] = [
  { table: "event_photos", column: "image" },
  { table: "events", column: "cover_image" },
  { table: "news_posts", column: "cover_image" },
  { table: "publications", column: "cover_image" },
  { table: "pages", column: "image" },
  { table: "board_members", column: "photo" },
  { table: "partners", column: "logo" },
];

await db();

const urls = new Set<string>();
for (const { table, column } of SOURCES) {
  const rows = await all<Record<string, string>>(
    `SELECT ${column} AS value FROM ${table} WHERE ${column} != ''`,
  );
  for (const row of rows) urls.add(row.value);
}
const settings = await all<{ value: string }>(
  "SELECT value FROM site_settings WHERE key IN ('hero_image', 'hero_background', 'section_banner') AND value != ''",
);
for (const row of settings) urls.add(row.value);

console.log(`${urls.size} stored files referenced.${apply ? "" : " Reporting only — pass --apply to rewrite."}\n`);

let before = 0;
let after = 0;
let rewritten = 0;

for (const url of [...urls].sort()) {
  // Only blobs can be rewritten from here; a /brand/ or /uploads/ path is a repo or
  // volume file and belongs to whoever put it there.
  if (!/^https?:\/\/.*\.public\.blob\.vercel-storage\.com\//.test(url)) {
    console.log(`  skip (not a blob)  ${url.slice(0, 72)}`);
    continue;
  }

  const response = await fetch(url);
  if (!response.ok) {
    console.log(`  FETCH ${response.status}       ${url.slice(-48)}`);
    continue;
  }
  const contentType = response.headers.get("content-type") ?? "";
  const original = Buffer.from(await response.arrayBuffer());
  before += original.length;

  if (!contentType.startsWith("image/") || contentType === "image/svg+xml") {
    after += original.length;
    console.log(`  skip (${contentType || "unknown"})  ${url.slice(-48)}`);
    continue;
  }

  const meta = await sharp(original).metadata();
  const width = meta.width ?? 0;
  if (original.length <= LEAVE_ALONE_BYTES && width <= MAX_WIDTH) {
    after += original.length;
    console.log(`  keep  ${String(Math.round(original.length / 1024)).padStart(5)} KB  ${width}px  ${url.slice(-48)}`);
    continue;
  }

  const pipeline = sharp(original).resize({ width: Math.min(width || MAX_WIDTH, MAX_WIDTH), withoutEnlargement: true });
  // Keep the format: a PNG logo with transparency must not become an opaque JPEG.
  const resized =
    meta.format === "png"
      ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
      : meta.format === "webp"
        ? await pipeline.webp({ quality: 78 }).toBuffer()
        : await pipeline.jpeg({ quality: 78, mozjpeg: true }).toBuffer();

  // A re-encode that grew the file is not an improvement.
  if (resized.length >= original.length) {
    after += original.length;
    console.log(`  keep  ${String(Math.round(original.length / 1024)).padStart(5)} KB  ${width}px  (re-encode was larger)  ${url.slice(-48)}`);
    continue;
  }

  after += resized.length;
  const saved = Math.round((1 - resized.length / original.length) * 100);
  console.log(
    `  ${apply ? "WRITE" : "would"} ${String(Math.round(original.length / 1024)).padStart(5)} KB → ${String(Math.round(resized.length / 1024)).padStart(4)} KB  (-${saved}%)  ${width}px → ${Math.min(width, MAX_WIDTH)}px  ${url.slice(-48)}`,
  );

  if (apply) {
    const { put } = await import("@vercel/blob");
    const pathname = new URL(url).pathname.replace(/^\//, "");
    await put(pathname, resized, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    rewritten += 1;
  }
}

console.log(
  `\n${Math.round(before / 1024)} KB → ${Math.round(after / 1024)} KB` +
    (apply ? `  (${rewritten} rewritten)` : "  if applied"),
);
