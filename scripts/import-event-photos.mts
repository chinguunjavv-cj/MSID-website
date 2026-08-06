/**
 * Attaches photographs to an event.
 *
 *   npm run import:photos -- --event <slug> \
 *     --photo "/path/IMG_1505.jpg" --alt-mn "…" --alt-en "…" \
 *     [--caption-mn "…"] [--caption-en "…"]
 *
 * Repeat the `--photo … --alt-mn … --alt-en …` group once per photograph; each group
 * runs until the next `--photo`.
 *
 * Idempotent on the source filename, which is recorded so a re-run replaces a
 * photograph rather than appending a second copy of it. The stored image itself is a
 * fresh upload each time, because the file is reshaped on the way in.
 *
 * Photographs are stored whole (`photo` shape — no crop), because these are the
 * Society's record of its own activity and a crop decided by a script is not
 * recoverable later.
 *
 * Alt text and captions are supplied on the command line rather than written here: what
 * a photograph shows is a fact about the photograph, and it should come from somebody
 * who was there, not from whoever is running the import.
 */

import { basename } from "node:path";
import { get, newId, run } from "../src/lib/db/index.ts";
import { mimeFor, storeFile } from "./lib/store-file.mts";

interface Incoming {
  source: string;
  altMn: string;
  altEn: string;
  captionMn: string;
  captionEn: string;
}

/* Walks argv in order so each --photo collects the flags that follow it. */
function parse(argv: string[]): { slug: string; photos: Incoming[] } {
  let slug = "";
  const photos: Incoming[] = [];

  for (let i = 0; i < argv.length; i++) {
    const value = argv[i + 1] ?? "";
    switch (argv[i]) {
      case "--event":
        slug = value;
        i++;
        break;
      case "--photo":
        photos.push({
          source: value,
          altMn: "",
          altEn: "",
          captionMn: "",
          captionEn: "",
        });
        i++;
        break;
      case "--alt-mn":
      case "--alt-en":
      case "--caption-mn":
      case "--caption-en": {
        const current = photos.at(-1);
        if (!current) {
          throw new Error(`${argv[i]} came before any --photo`);
        }
        const key = {
          "--alt-mn": "altMn",
          "--alt-en": "altEn",
          "--caption-mn": "captionMn",
          "--caption-en": "captionEn",
        }[argv[i]] as keyof Incoming;
        current[key] = value;
        i++;
        break;
      }
    }
  }

  return { slug, photos };
}

const { slug, photos } = parse(process.argv.slice(2));

if (!slug) throw new Error("--event <slug> is required");
if (photos.length === 0) throw new Error("at least one --photo is required");

const event = await get<{ id: string }>(
  "SELECT id FROM events WHERE slug = ?",
  slug,
);
if (!event) throw new Error(`No event with slug ${slug}`);

let created = 0;
let replaced = 0;

for (const [index, photo] of photos.entries()) {
  const source = basename(photo.source);
  const stored = await storeFile(photo.source, mimeFor(photo.source), "photo");

  /*
    The source filename is the identity. Without it a re-run — to correct one caption —
    would append the whole set a second time, and a gallery of duplicates is worse than
    a gallery with a typo in it.
  */
  const existing = await get<{ id: string }>(
    "SELECT id FROM event_photos WHERE event_id = ? AND id LIKE ?",
    event.id,
    `${source}:%`,
  );

  const columns = {
    image: stored,
    alt_mn: photo.altMn,
    alt_en: photo.altEn,
    caption_mn: photo.captionMn,
    caption_en: photo.captionEn,
    sort: index + 1,
  };
  const keys = Object.keys(columns) as (keyof typeof columns)[];

  if (existing) {
    await run(
      `UPDATE event_photos SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`,
      ...keys.map((k) => columns[k]),
      existing.id,
    );
    replaced++;
  } else {
    await run(
      `INSERT INTO event_photos (id, event_id, ${keys.join(", ")})
       VALUES (?, ?, ${keys.map(() => "?").join(", ")})`,
      `${source}:${newId()}`,
      event.id,
      ...keys.map((k) => columns[k]),
    );
    created++;
  }
  console.log(`  ${source} → ${stored}`);
}

console.log(`  ${slug}: ${created} added, ${replaced} replaced.`);
process.exit(0);
