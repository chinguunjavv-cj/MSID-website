/**
 * Imports past events, with their cover photographs.
 *
 *   npm run import:events -- --aocc <cover.jpg> --ddweek <cover.jpg>
 *
 * Idempotent on the slug, so a corrected title or date can simply be re-run. A cover is
 * only replaced when a new file is supplied.
 *
 * Every fact below was read off the photographs themselves — a banner, a slide logo, a
 * capture date — and nothing is inferred. Where a detail could not be read (the venue
 * of the DDWeek session, the full run of dates) the field is left empty rather than
 * filled with a plausible guess: this is a medical society's public record of its own
 * activity, and a confidently wrong date is worse than a missing one.
 */

import { get, newId, run } from "../src/lib/db/index.ts";
import { mimeFor, storeFile } from "./lib/store-file.mts";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

interface PastEvent {
  slug: string;
  kind: string;
  titleMn: string;
  titleEn: string;
  summaryMn: string;
  summaryEn: string;
  bodyMn: string;
  bodyEn: string;
  startsOn: string;
  endsOn: string | null;
  cityMn: string;
  cityEn: string;
  coverAltMn: string;
  coverAltEn: string;
  coverFlag: string;
}

const EVENTS: PastEvent[] = [
  {
    slug: "aocc-2024-xian",
    kind: "conference",
    titleMn:
      "Азийн Крон, колитын байгууллагын (AOCC) 12 дугаар их хурал",
    titleEn:
      "The 12th Annual Meeting of the Asian Organization for Crohn's and Colitis",
    summaryMn:
      "Нийгэмлэгийн төлөөлөгчид БНХАУ-ын Шиань хотод болсон AOCC-ийн 12 дугаар их хуралд оролцлоо.",
    summaryEn:
      "A delegation from the Society took part in the 12th AOCC Annual Meeting in Xi'an, China.",
    bodyMn:
      "Азийн Крон, колитын байгууллага (AOCC)-ын 12 дугаар их хурал 2024 оны 6 дугаар сарын 14–16-ны өдрүүдэд БНХАУ-ын Шиань хотод зохион байгуулагдаж, манай нийгэмлэгийн төлөөлөгчид оролцов.",
    bodyEn:
      "The 12th Annual Meeting of the Asian Organization for Crohn's and Colitis was held in Xi'an, China on 14–16 June 2024. A delegation from the Society attended.",
    startsOn: "2024-06-14",
    endsOn: "2024-06-16",
    cityMn: "Шиань, БНХАУ",
    cityEn: "Xi'an, China",
    coverAltMn:
      "Нийгэмлэгийн зургаан төлөөлөгч AOCC-ийн 12 дугаар их хурлын самбарын өмнө зогсож байна.",
    coverAltEn:
      "Six delegates from the Society standing in front of the 12th AOCC Annual Meeting banner.",
    coverFlag: "aocc",
  },
  {
    slug: "ddweek-2024-ibd",
    kind: "conference",
    titleMn:
      "Хоол боловсруулахын долоо хоног (DDWeek) 2024 — гэдэсний үрэвсэлт эмгэгийн хуралдаан",
    titleEn:
      "Digestive Disease Week 2024 — session on inflammatory bowel disease",
    summaryMn:
      "DDWeek 2024 олон улсын хурлын үеэр нийгэмлэгээс гэдэсний үрэвсэлт эмгэгийн хуралдааныг зохион байгууллаа.",
    summaryEn:
      "The Society organised a session on inflammatory bowel disease during Digestive Disease Week 2024.",
    bodyMn:
      "Монголын Гастроэнтерологичдын холбооны зохион байгуулсан Хоол боловсруулахын долоо хоног (DDWeek) 2024 олон улсын хурлын үеэр нийгэмлэгээс гэдэсний үрэвсэлт эмгэгт зориулсан хуралдааныг зохион байгуулав.\n\nХуралдаанаар Кроны өвчин болон бүдүүн шулуун гэдэсний шархлаат үрэвслийн оношилгоо, эмчилгээний асуудлыг хэлэлцэв.",
    bodyEn:
      "During Digestive Disease Week 2024, organised by the Mongolian Gastroenterology Association, the Society held a session devoted to inflammatory bowel disease.\n\nThe session covered the diagnosis and treatment of Crohn's disease and ulcerative colitis.",
    startsOn: "2024-06-22",
    endsOn: null,
    cityMn: "Улаанбаатар",
    cityEn: "Ulaanbaatar",
    coverAltMn:
      "Илтгэгч бүдүүн шулуун гэдэсний шархлаат үрэвслийн талаар илтгэж, танхимд сонсогчид суулаа.",
    coverAltEn:
      "A speaker presenting on ulcerative colitis to an audience in a conference hall.",
    coverFlag: "ddweek",
  },
];

let created = 0;
let updated = 0;

for (const event of EVENTS) {
  const coverPath = flag(event.coverFlag);
  const cover = coverPath
    ? await storeFile(coverPath, mimeFor(coverPath), "cover")
    : undefined;

  const columns: Record<string, string | number | null> = {
    slug: event.slug,
    kind: event.kind,
    status: "published",
    title_mn: event.titleMn,
    title_en: event.titleEn,
    summary_mn: event.summaryMn,
    summary_en: event.summaryEn,
    body_mn: event.bodyMn,
    body_en: event.bodyEn,
    starts_on: event.startsOn,
    ends_on: event.endsOn,
    city_mn: event.cityMn,
    city_en: event.cityEn,
    cover_alt_mn: event.coverAltMn,
    cover_alt_en: event.coverAltEn,
    // A past event takes no registrations.
    registration_open: 0,
  };
  if (cover) columns.cover_image = cover;

  const existing = await get<{ id: string }>(
    "SELECT id FROM events WHERE slug = ?",
    event.slug,
  );
  const keys = Object.keys(columns);

  if (existing) {
    await run(
      `UPDATE events SET ${keys.map((k) => `${k} = ?`).join(", ")},
         updated_at = datetime('now') WHERE id = ?`,
      ...keys.map((k) => columns[k]),
      existing.id,
    );
    updated++;
  } else {
    await run(
      `INSERT INTO events (id, ${keys.join(", ")})
       VALUES (?, ${keys.map(() => "?").join(", ")})`,
      newId(),
      ...keys.map((k) => columns[k]),
    );
    created++;
  }
  if (cover) console.log(`  ${event.slug}: cover at ${cover}`);
}

console.log(`  Events: ${created} created, ${updated} updated.`);
process.exit(0);
