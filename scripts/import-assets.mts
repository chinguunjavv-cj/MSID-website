/**
 * Imports the files and page text MSID supplied: the President's portrait and greeting,
 * and the Ministry of Health's ulcerative colitis guideline.
 *
 *   npm run import:assets -- --photo <portrait.jpg> --guideline <guideline.pdf>
 *
 * Both flags are optional, so a later batch can bring one without the other. Idempotent
 * on the guideline (matched on its slug) and on the page text.
 *
 * Run against production the same way as the board import, by supplying TURSO_* — and
 * BLOB_READ_WRITE_TOKEN, or the files land on a local disk Vercel cannot read.
 */

import { get, newId, run } from "../src/lib/db/index.ts";
import { mimeFor, storeFile } from "./lib/store-file.mts";
import { statSync } from "node:fs";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const photoPath = flag("photo");
const guidelinePath = flag("guideline");

/* -------------------------------------------------------------------------- */
/* The President's portrait                                                    */
/* -------------------------------------------------------------------------- */

if (photoPath) {
  const stored = await storeFile(photoPath, mimeFor(photoPath));
  const { changes } = await run(
    "UPDATE board_members SET photo = ? WHERE name_en = ?",
    stored,
    "Bayarmaa O.",
  );
  console.log(`  Portrait stored at ${stored} (${changes} row updated)`);
}

/* -------------------------------------------------------------------------- */
/* The President's greeting                                                    */
/* -------------------------------------------------------------------------- */

/*
  Replaces the placeholder welcome text. Kept as plain paragraphs separated by blank
  lines, which is what `Prose` splits on — the site stores text, never HTML.

  Her signature keeps the full patronymic form, Очирхүрээгийн Баярмаа, rather than the
  О.Баярмаа used in the board grid: a signature is where the whole name belongs.
*/
const GREETING_MN = `Та бүхэнд манай сайтаар зочлон бидний үйл ажиллагаатай танилцах сайхан өдрийн мэндийг хүргэн мэндчилье.

Хүн амын өсөлт, хотжилт, байгаль, нийгмийн уур амьсгал, амьдралын ба хооллолтын хэв маягийн өөрчлөлт болон гэдэсний эмгэгийн оношилгооны олон арга, технологиуд эмнэлзүйн практикт нэвтэрснээр гэдэсний үрэвсэлт эмгэг, хавдрын илрүүлэлт нэмэгдэж, Монгол Улс 2019 оноос дэлхийн эрүүл мэндийн статистик үзүүлэлтийн тайланд 100.000 хүн амд 50–75 тохиолдол бүртгэгддэг улс орны тоонд орох болсон.

Гэсэн хэдий ч манай улсад гэдэсний үрэвсэлт эмгэгийн оношилгоо, эмчилгээ бүрэн шийдэгдээгүй, эрүүл мэндийн тулгамдсан асуудлын нэг хэвээр байсаар байна. Тиймээс гэдэсний үрэвсэлт эмгэгийн талаарх судалгаа, шинжилгээний ажлыг хөгжүүлэх, бүртгэлийг сайжруулах, оношилгоо, эмчилгээг олон улсын жишигт хүргэх, гадаад, дотоод хамтын ажиллагаагаа өргөжүүлэх зорилгоор бид нийгэмлэгээ үүсгэн байгуулж, гастроэнтеролог, хүүхдийн гастроэнтеролог, бүдүүн шулуун гэдэсний мэс засал, эмнэлзүйн эмгэг судлал, дүрс оношилгоо, лабораторийн эмч, багш нараас бүрдсэн удирдах зөвлөлийн бүрэлдэхүүнтэйгээр үйл ажиллагаагаа эхлүүлээд байна.

Бид энэ хугацаанд 2023, 2024 оны Азийн Крон, колитын байгууллага (AOCC), Солонгосын гэдэсний эмгэг судлалын холбоо (KASID)-ны олон улсын хуралд оролцож, МГХ-ны Хоол боловсруулахын долоо хоног (DDWeek) 2024 олон улсын хурлын үеэр гэдэсний үрэвсэлт эмгэгийн хуралдаан, Тайваний Үндэсний Их Сургуулийн профессоруудтай хамтарсан сургалтыг тус тус зохион байгууллаа.

Мөн 2025 оноос Солонгосын гэдэсний эмгэг судлалын холбоо (KASID)-той хамтын ажиллагаагаа эхлүүлж, Азийн Крон, колитын байгууллага (AOCC)-д гишүүнээр элсэх хүсэлтээ илэрхийлээд байна.

Гэдэсний үрэвсэлт эмгэгийн оношилгоо, эмчилгээний удирдамжийг шинэчлэн боловсруулах, олон улсаас суралцах, иргэдэд эрүүл мэндийн боловсрол олгож, тэдний амьдралын чанарыг дээшлүүлэхийн төлөө хамтран ажиллах, нийгэмд чиглэсэн арга хэмжээнүүдийг зохион байгуулах, виртуал ертөнц, цахим харилцааг эрхэмлэх нь бидний ирээдүйн зорилтууд юм.

Таныг энэхүү түүхэн цаг мөчид бидэнтэй хамт байж нийгэмлэгийн хөгжилд үнэтэй хувь нэмэр оруулна гэдэгт итгэж байна.

Сайн үйлс бүхэн дэлгэрэх болтугай.

Очирхүрээгийн Баярмаа
Ерөнхийлөгч, Анагаах ухааны доктор
Монгол Улсын төрийн соёрхолт, Хүний гавьяат эмч`;

const GREETING_EN = `Welcome, and thank you for visiting our website.

Population growth, urbanisation, environmental and social change, shifting diets and ways of living, together with the many new methods and technologies now used to diagnose intestinal disease, have all increased the detection of inflammatory bowel disease and of cancer. Since 2019 Mongolia has appeared in world health statistics among the countries recording 50–75 cases per 100,000 people.

Even so, the diagnosis and treatment of inflammatory bowel disease in Mongolia is not yet resolved, and it remains one of the country's pressing health problems. The Society was founded to develop research into inflammatory bowel disease, improve its registration, bring diagnosis and treatment to international standards, and widen collaboration at home and abroad. Our board brings together gastroenterologists, paediatric gastroenterologists, colorectal surgeons, clinical pathologists, radiologists, laboratory physicians and teachers.

In that time we have taken part in the international congresses of the Asian Organization for Crohn's and Colitis (AOCC) and the Korean Association for the Study of Intestinal Diseases (KASID) in 2023 and 2024, held a session on inflammatory bowel disease during Digestive Disease Week 2024, and run joint training with professors from National Taiwan University.

From 2025 we have begun working with KASID, and have applied to join the AOCC as a member.

Our aims are to revise the guidelines for diagnosing and treating inflammatory bowel disease, to learn from international practice, to work towards health education and a better quality of life for the public, to organise events for the wider community, and to make good use of digital communication.

We hope you will join us at this moment in our history and contribute to the Society's development.

With every good wish.

Bayarmaa Ochirkhuree
President, MD, PhD
State Prize laureate and Honoured Physician of Mongolia`;

await run(
  `UPDATE pages SET title_mn = ?, title_en = ?, body_mn = ?, body_en = ?,
     updated_at = datetime('now')
   WHERE key = 'about.welcome'`,
  "Ерөнхийлөгчийн мэндчилгээ",
  "A message from the President",
  GREETING_MN,
  GREETING_EN,
);
console.log("  Welcome page replaced with the President's greeting.");

/* -------------------------------------------------------------------------- */
/* The ulcerative colitis guideline                                            */
/* -------------------------------------------------------------------------- */

if (guidelinePath) {
  const stored = await storeFile(guidelinePath, mimeFor(guidelinePath));
  const size = statSync(guidelinePath).size;
  const slug = "buduun-gedesnii-sharkhlaat-urevsel";

  /*
    Authorship is stated in the summary rather than left implied. This is the Ministry
    of Health's guideline, approved by ministerial order, not one MSID wrote — and a
    register of clinical guidance that is vague about who approved a document is worse
    than useless to the clinician reading it.
  */
  const columns = {
    slug,
    code: "ЭМС-ын тушаал А/703",
    version: "2021",
    status: "published",
    title_mn: "Бүдүүн гэдэсний шархлаат үрэвслийн оношилгоо, эмчилгээний эмнэлзүйн заавар",
    title_en:
      "Clinical guideline for the diagnosis and treatment of ulcerative colitis",
    summary_mn:
      "Эрүүл мэндийн сайдын 2021 оны 11 дүгээр сарын 16-ны өдрийн А/703 дугаар тушаалаар батлагдсан эмнэлзүйн заавар. Өвчний код (ӨОУХА-10): K51.",
    summary_en:
      "Approved by Order A/703 of the Minister of Health of Mongolia, 16 November 2021. ICD-10 code: K51.",
    body_mn:
      "Энэхүү заавар нь бүдүүн гэдэсний шархлаат үрэвслийн оношилгоо, эмчилгээний талаар гастроэнтерологич, дотрын, ерөнхий мэргэжлийн, өрхийн, мэс заслын, бүдүүн шулуун гэдэсний мэс заслын, дурангийн эмч болон резидент, олгох суралцагч эмч нарт зориулагдсан.\n\nЗорилго нь өвчтөнд үзүүлэх тусламж үйлчилгээний хүртээмжийг сайжруулах, үр дүнтэй нотолгоонд суурилсан эмнэлгийн тусламж үйлчилгээний чанарыг сайжруулах, өвчнийг оношлох, эмчлэх аргыг боловсруулж дагаж мөрдөх, хүндрэл, нас баралтыг бууруулахад оршино.",
    body_en:
      "This guideline covers the diagnosis and treatment of ulcerative colitis. It is written for gastroenterologists, internists, general and family practitioners, surgeons, colorectal surgeons, endoscopists, and residents in training.\n\nIts purpose is to improve access to care, raise the quality of evidence-based treatment, establish methods for diagnosis and management, and reduce complications and mortality.",
    category_mn: "Гэдэсний үрэвсэлт эмгэг",
    category_en: "Inflammatory bowel disease",
    approved_on: "2021-11-16",
    effective_from: "2021-11-16",
    file_path: stored,
    file_size: size,
  };

  const existing = await get<{ id: string }>(
    "SELECT id FROM guidelines WHERE slug = ?",
    slug,
  );
  const keys = Object.keys(columns);

  if (existing) {
    await run(
      `UPDATE guidelines SET ${keys.map((k) => `${k} = ?`).join(", ")},
         updated_at = datetime('now') WHERE id = ?`,
      ...keys.map((k) => columns[k as keyof typeof columns]),
      existing.id,
    );
    console.log(`  Guideline updated; file at ${stored}`);
  } else {
    await run(
      `INSERT INTO guidelines (id, ${keys.join(", ")})
       VALUES (?, ${keys.map(() => "?").join(", ")})`,
      newId(),
      ...keys.map((k) => columns[k as keyof typeof columns]),
    );
    console.log(`  Guideline created; file at ${stored}`);
  }
}

process.exit(0);
