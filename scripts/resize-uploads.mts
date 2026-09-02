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
 * Each file is measured against what its column is displayed at — a gallery photograph
 * against the lightbox, a partner's mark against the 48px box it sits in — because a
 * mark can be a tidy 40 KB and still be a 1028px square, which is most of its weight
 * thrown away.
 *
 * The blob keeps its pathname, so every row that references it stays correct and nothing
 * in the database has to change. Files already small enough are left alone, which makes
 * the script safe to run twice.
 */

import sharp from "sharp";
import { all, db } from "../src/lib/db/index.ts";

/*
  What each kind of picture is actually shown at, doubled for retina. Judging by file
  size alone is not enough: a partner's mark can be a tidy 40 KB and still be a 1028px
  square standing in a box 48px tall.
*/
const SIZES = {
  /** Gallery and cover photographs, up to full-bleed. */
  photo: { width: 1600, height: 1600, floor: 120 * 1024 },
  /** Board portraits, declared 480x600. */
  portrait: { width: 960, height: 1200, floor: 60 * 1024 },
  /** Partner marks, declared 240x96 in a 3rem box. */
  mark: { width: 480, height: 192, floor: 8 * 1024 },
} as const;

type Kind = keyof typeof SIZES;

const apply = process.argv.includes("--apply");

/** Every column that holds a stored file path. PDFs are skipped by content type. */
const SOURCES: { table: string; column: string; kind: Kind }[] = [
  { table: "event_photos", column: "image", kind: "photo" },
  { table: "events", column: "cover_image", kind: "photo" },
  { table: "news_posts", column: "cover_image", kind: "photo" },
  { table: "publications", column: "cover_image", kind: "photo" },
  { table: "pages", column: "image", kind: "photo" },
  { table: "board_members", column: "photo", kind: "portrait" },
  { table: "partners", column: "logo", kind: "mark" },
];

await db();

/*
  A file referenced from two places takes the more generous size of the two, so a
  photograph reused as a partner's mark is never quantised down to a logo.
*/
const urls = new Map<string, Kind>();
const RANK: Kind[] = ["mark", "portrait", "photo"];
const remember = (url: string, kind: Kind) => {
  const seen = urls.get(url);
  if (!seen || RANK.indexOf(kind) > RANK.indexOf(seen)) urls.set(url, kind);
};

for (const { table, column, kind } of SOURCES) {
  const rows = await all<Record<string, string>>(
    `SELECT ${column} AS value FROM ${table} WHERE ${column} != ''`,
  );
  for (const row of rows) remember(row.value, kind);
}
const settings = await all<{ value: string }>(
  "SELECT value FROM site_settings WHERE key IN ('hero_image', 'hero_background', 'section_banner') AND value != ''",
);
for (const row of settings) remember(row.value, "photo");

console.log(
  `${urls.size} stored files referenced.${apply ? "" : " Reporting only — pass --apply to rewrite."}\n`,
);

let before = 0;
let after = 0;
let rewritten = 0;

for (const [url, kind] of [...urls].sort(([a], [b]) => a.localeCompare(b))) {
  const limit = SIZES[kind];

  // Only blobs can be rewritten from here; a /brand/ path is a repo file and belongs
  // to whoever committed it.
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
  const height = meta.height ?? 0;
  const fits = width <= limit.width && height <= limit.height;
  if (original.length <= limit.floor && fits) {
    after += original.length;
    console.log(
      `  keep  ${String(Math.round(original.length / 1024)).padStart(5)} KB  ${width}x${height}  ${url.slice(-48)}`,
    );
    continue;
  }

  // `inside` so neither edge exceeds the box; a tall portrait is bound by its height.
  const pipeline = sharp(original).resize({
    width: limit.width,
    height: limit.height,
    fit: "inside",
    withoutEnlargement: true,
  });
  /*
    Keep the format: a PNG mark with transparency must not become an opaque JPEG.
    Marks are flat colour, so a palette costs them nothing and saves most of the file;
    photographs would band, and stay full-colour.
  */
  const resized =
    meta.format === "png"
      ? await pipeline
          .png(kind === "mark" ? { palette: true, quality: 90, effort: 10 } : { compressionLevel: 9 })
          .toBuffer()
      : meta.format === "webp"
        ? await pipeline.webp({ quality: 78 }).toBuffer()
        : await pipeline.jpeg({ quality: 78, mozjpeg: true }).toBuffer();

  /*
    A JPEG that is already the right size re-encodes to within a few per cent of itself,
    and paying a lossy generation for 5% is a bad trade. Only rewrite when the saving is
    worth having.
  */
  const MIN_SAVING = 0.1;
  if (resized.length > original.length * (1 - MIN_SAVING)) {
    after += original.length;
    console.log(
      `  keep  ${String(Math.round(original.length / 1024)).padStart(5)} KB  ${width}x${height}  (re-encode saved too little)  ${url.slice(-48)}`,
    );
    continue;
  }

  after += resized.length;
  const saved = Math.round((1 - resized.length / original.length) * 100);
  const out = await sharp(resized).metadata();
  console.log(
    `  ${apply ? "WRITE" : "would"} ${String(Math.round(original.length / 1024)).padStart(5)} KB → ${String(Math.round(resized.length / 1024)).padStart(4)} KB  (-${saved}%)  ${width}x${height} → ${out.width}x${out.height}  ${kind}  ${url.slice(-48)}`,
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
