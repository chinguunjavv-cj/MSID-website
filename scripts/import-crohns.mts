/**
 * Adds the Ministry of Health's Crohn's disease guideline to the register.
 *
 *   npm run import:crohns -- --pdf <guideline.pdf>
 *
 * The PDF is the one assembled from the two Word files MSID sent on 17 September 2026:
 * the guideline itself ("CD 2024.07.25.docx", 34 pages) with its five treatment
 * flowcharts ("CD treatment 2024-07.25.docx") placed before the bibliography, where the
 * guideline's own contents list puts them. Its first page names order А/367, which
 * approved this 2024 revision; the draft still carried the heading of the 2022 order.
 *
 * Kept apart from `import-assets.mts` on purpose: that script also rewrites the welcome
 * letter and the membership page every time it runs, which would undo any edit the
 * Society has made to them since.
 *
 * Idempotent: matched on its slug, so running it again replaces the file and the text.
 * Run against production with TURSO_* and BLOB_READ_WRITE_TOKEN set, as the other
 * imports are.
 */

import { get, newId, run, slugify } from "../src/lib/db/index.ts";
import { storeFile } from "./lib/store-file.mts";
import { statSync } from "node:fs";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const pdfPath = flag("pdf");
if (!pdfPath) {
  console.error("Usage: npm run import:crohns -- --pdf <guideline.pdf>");
  process.exit(1);
}

/*
  Say which database this is about to write to. Without TURSO_* the shared db() quietly
  falls back to the local file, and a run that "worked" has changed nothing on the live
  site — which is exactly how the first resize run went.
*/
const remote = process.env.TURSO_DATABASE_URL?.trim();
if (remote && !process.env.BLOB_READ_WRITE_TOKEN?.trim()) {
  console.error(
    "TURSO_DATABASE_URL is set but BLOB_READ_WRITE_TOKEN is not. The PDF would be saved on\n" +
      "this laptop and the live site would link to a file it cannot serve. Set both.",
  );
  process.exit(1);
}
console.log(
  remote
    ? `Writing to the production database (${new URL(remote.replace(/^libsql:/, "https:")).host}).`
    : "Writing to the LOCAL database (./data/msid.db). The live site will not change.",
);

const title_mn = "Кроны өвчний эмнэлзүйн заавар";
const slug = slugify(title_mn);
const stored = await storeFile(pdfPath, "application/pdf");

/*
  Worded like the ulcerative colitis entry: who approved it, by which order, and the
  disease code, because a clinician reading the register needs to know the document's
  standing before its content. The body is sections А.3 and А.4 of the guideline.
*/
const columns = {
  slug,
  code: "ЭМС-ын тушаал А/367",
  version: "2025",
  status: "published",
  title_mn,
  title_en: "Clinical guideline for Crohn's disease",
  summary_mn:
    "Эрүүл мэндийн сайдын 2025 оны 10 дугаар сарын 3-ны өдрийн А/367 дугаар тушаалаар батлагдсан эмнэлзүйн заавар. Өвчний код (ӨОУХА-10): K50. Эмчилгээний таван алгоритм хавсралтаар орсон.",
  summary_en:
    "Approved by Order A/367 of the Minister of Health of Mongolia, 3 October 2025. ICD-10 code: K50. Includes five treatment algorithms as appendices.",
  body_mn:
    "Энэхүү заавар нь ерөнхий мэргэжлийн болон өрхийн эмч, резидент эмч, дотрын эмч, гастроэнтерологич, мэс заслын эмч, яаралтай тусламжийн эмч, түүнчлэн үйлчлүүлэгч болон Эрүүл мэндийн даатгалын ерөнхий газарт зориулагдсан.\n\nКроны өвчний талаарх эмч нарын мэдлэгийг дээшлүүлэн, оношилгоо, эмчилгээ, хяналтыг сайжруулснаар хүндрэл ба нас баралтыг бууруулахад зааврын зорилго оршино. Зорилт нь Кроны өвчний оношилгоог боловсронгуй болгох, эмчилгээний алгоритмыг боловсруулах, хяналтыг сайжруулах юм.",
  body_en:
    "This guideline is written for general and family practitioners, residents, internists, gastroenterologists, surgeons and emergency physicians, as well as for patients and the General Agency for Health Insurance.\n\nIts purpose is to reduce complications and mortality by improving physicians' knowledge of Crohn's disease and the diagnosis, treatment and monitoring of patients. Its objectives are to refine the diagnosis of Crohn's disease, establish treatment algorithms, and improve monitoring.",
  category_mn: "Гэдэсний үрэвсэлт эмгэг",
  category_en: "Inflammatory bowel disease",
  approved_on: "2025-10-03",
  effective_from: "2025-10-03",
  file_path: stored,
  file_size: statSync(pdfPath).size,
};

const existing = await get<{ id: string }>("SELECT id FROM guidelines WHERE slug = ?", slug);
const keys = Object.keys(columns);

if (existing) {
  await run(
    `UPDATE guidelines SET ${keys.map((k) => `${k} = ?`).join(", ")},
       updated_at = datetime('now') WHERE id = ?`,
    ...keys.map((k) => columns[k as keyof typeof columns]),
    existing.id,
  );
  console.log(`  Guideline updated: /guidelines/${slug}\n  File at ${stored}`);
} else {
  await run(
    `INSERT INTO guidelines (id, ${keys.join(", ")})
     VALUES (?, ${keys.map(() => "?").join(", ")})`,
    newId(),
    ...keys.map((k) => columns[k as keyof typeof columns]),
  );
  console.log(`  Guideline created: /guidelines/${slug}\n  File at ${stored}`);
}

process.exit(0);
