/**
 * Sample content, so the site can be seen working before MSID's real content arrives.
 *
 *   npm run demo         add sample records
 *   npm run demo:clear   remove every record this script created
 *
 * Everything it writes carries `DEMO` in its slug or code, and `--clear` deletes
 * exactly those rows and nothing else. None of this is real MSID information: the
 * names, dates and guideline numbers are invented placeholders.
 */

import { db, get, newId, run } from "../src/lib/db/index.ts";

await db();

const clear = process.argv.includes("--clear");

if (clear) {
  const events = await run("DELETE FROM events WHERE slug LIKE 'demo-%'");
  await run("DELETE FROM guidelines WHERE slug LIKE 'demo-%'");
  await run("DELETE FROM publications WHERE slug LIKE 'demo-%'");
  await run("DELETE FROM news_posts WHERE slug LIKE 'demo-%'");
  await run("DELETE FROM board_members WHERE bio_en LIKE 'DEMO%'");
  console.log(`Removed sample content (${events.changes} events and related records).`);
  process.exit(0);
}

/* -------------------------------------------------------------------------- */
/* Congress with fees and a programme                                          */
/* -------------------------------------------------------------------------- */

const year = new Date().getFullYear() + 1;
const congressSlug = "demo-msid-congress";

let congressId = (
  await get<{ id: string }>("SELECT id FROM events WHERE slug = ?", congressSlug)
)?.id;

if (!congressId) {
  congressId = newId();
  await run(
    `INSERT INTO events
       (id, slug, kind, status, title_mn, title_en, summary_mn, summary_en,
        body_mn, body_en, venue_mn, venue_en, city_mn, city_en,
        starts_on, ends_on, registration_open, registration_closes_on,
        abstract_deadline, early_bird_deadline, capacity, is_featured)
     VALUES (?, ?, 'congress', 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 1)`,
    congressId,
    congressSlug,
    `Гэдэсний эмгэг судлалын ${year} оны их хурал`,
    `MSID Congress ${year}`,
    "Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэгийн жил тутмын эрдэм шинжилгээний их хурал.",
    "The annual scientific congress of the Mongolian Society of Intestinal Disease.",
    `Их хурлаар үрэвсэлт гэдэсний өвчний оношилгоо, эмчилгээний сүүлийн үеийн чиг хандлага, дурангийн шинжилгээний шинэ арга технологи, бүдүүн гэдэсний хорт хавдрын эрт илрүүлгийн асуудлыг хэлэлцэнэ.

Гадаад, дотоодын эрдэмтэн, эмч нар илтгэл тавьж, кейс хэлэлцүүлэг зохион байгуулагдана. Илтгэлийн хураангуйг доор заасан хугацаанд хүлээн авна.`,
    `The congress covers current approaches to the diagnosis and treatment of inflammatory bowel disease, new endoscopic techniques, and early detection of colorectal cancer.

Speakers from Mongolia and abroad will present, alongside case conference sessions. Abstracts are accepted until the deadline shown.`,
    "Улсын клиникийн төв эмнэлгийн хурлын танхим",
    "State Central Clinical Hospital, Conference Hall",
    "Улаанбаатар",
    "Ulaanbaatar",
    `${year}-05-14`,
    `${year}-05-16`,
    `${year}-05-01`,
    `${year}-03-15`,
    `${year}-03-31`,
    250,
  );

  const fees: [string, string, string, number, number | null, number][] = [
    ["Нийгэмлэгийн гишүүн", "MSID member", "member", 120_000, 90_000, 1],
    ["Гишүүн бус", "Non-member", "non_member", 180_000, 150_000, 2],
    ["Резидент эмч, оюутан", "Resident / student", "trainee", 60_000, 45_000, 3],
    ["Гадаад оролцогч", "International participant", "international", 250_000, null, 4],
  ];

  for (const [labelMn, labelEn, audience, amount, early, sort] of fees) {
    await run(
      `INSERT INTO event_fees (id, event_id, label_mn, label_en, audience, amount_mnt, early_amount_mnt, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      congressId,
      labelMn,
      labelEn,
      audience,
      amount,
      early,
      sort,
    );
  }

  const sessions: [string, string, string, string, string, string, string, number][] = [
    [`${year}-05-14`, "09:00", "09:30", "Нээлтийн үг", "Opening address", "", "", 1],
    [`${year}-05-14`, "09:30", "10:15", "Үрэвсэлт гэдэсний өвчний тархвар зүй: Монголын нөхцөл байдал", "Epidemiology of IBD: the situation in Mongolia", "Илтгэгч тодорхойгүй", "Speaker to be confirmed", 2],
    [`${year}-05-14`, "10:45", "11:30", "Биологийн эмчилгээний заалт, хяналт", "Indications for and monitoring of biologic therapy", "Илтгэгч тодорхойгүй", "Speaker to be confirmed", 3],
    [`${year}-05-15`, "09:00", "10:30", "Дурангийн шинжилгээний кейс хэлэлцүүлэг", "Endoscopy case conference", "", "", 1],
    [`${year}-05-15`, "11:00", "12:00", "Бүдүүн гэдэсний хорт хавдрын эрт илрүүлэг", "Early detection of colorectal cancer", "Илтгэгч тодорхойгүй", "Speaker to be confirmed", 2],
    [`${year}-05-16`, "09:00", "11:00", "Залуу эрдэмтдийн илтгэл", "Young investigator session", "", "", 1],
  ];

  for (const [day, from, to, titleMn, titleEn, speakerMn, speakerEn, sort] of sessions) {
    await run(
      `INSERT INTO event_sessions
         (id, event_id, day, starts_at, ends_at, title_mn, title_en, speaker_mn, speaker_en, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      congressId,
      day,
      from,
      to,
      titleMn,
      titleEn,
      speakerMn,
      speakerEn,
      sort,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Training course                                                             */
/* -------------------------------------------------------------------------- */

if (!await get("SELECT id FROM events WHERE slug = 'demo-endoscopy-course'")) {
  await run(
    `INSERT INTO events
       (id, slug, kind, status, title_mn, title_en, summary_mn, summary_en,
        venue_mn, venue_en, city_mn, city_en, starts_on, ends_on, registration_open, capacity)
     VALUES (?, 'demo-endoscopy-course', 'training', 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 40)`,
    newId(),
    "Дурангийн шинжилгээний сургалт",
    "Endoscopy training course",
    "Гэдэсний дурангийн шинжилгээний практик сургалт. Оролцогчийн тоо хязгаартай.",
    "A practical course in intestinal endoscopy. Places are limited.",
    "Улсын клиникийн төв эмнэлэг",
    "State Central Clinical Hospital",
    "Улаанбаатар",
    "Ulaanbaatar",
    `${year}-09-10`,
    `${year}-09-11`,
  );
}

/* -------------------------------------------------------------------------- */
/* Guidelines                                                                  */
/* -------------------------------------------------------------------------- */

if (!await get("SELECT id FROM guidelines WHERE slug = 'demo-ibd-guideline'")) {
  await run(
    `INSERT INTO guidelines
       (id, slug, code, version, status, title_mn, title_en, summary_mn, summary_en,
        body_mn, body_en, category_mn, category_en, approved_on, effective_from, review_due)
     VALUES (?, 'demo-ibd-guideline', ?, '1.0', 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    `MSID-CG-${year - 1}-01`,
    "Үрэвсэлт гэдэсний өвчний оношилгоо, эмчилгээний эмнэлзүйн заавар",
    "Clinical guideline on the diagnosis and treatment of inflammatory bowel disease",
    "Крон өвчин болон шархлаат бүдүүн гэдэсний үрэвслийн оношилгоо, эмчилгээний үндсэн зарчмыг тодорхойлсон заавар.",
    "A guideline setting out the principles of diagnosis and treatment for Crohn's disease and ulcerative colitis.",
    `Энэхүү заавар нь Монгол Улсын эрүүл мэндийн байгууллагад үрэвсэлт гэдэсний өвчнийг оношлох, эмчлэх үйл ажиллагааг стандартчилах зорилготой.

Заавар нь дараах хэсгээс бүрдэнэ: оношилгооны алгоритм, эмчилгээний шатлал, хяналтын хуваарь, хүндрэлийн менежмент.

Тайлбар: энэ бол жишээ агуулга бөгөөд нийгэмлэгийн албан ёсны заавар биш болно.`,
    `This guideline aims to standardise the diagnosis and treatment of inflammatory bowel disease across health facilities in Mongolia.

It covers the diagnostic algorithm, the treatment ladder, the monitoring schedule, and the management of complications.

Note: this is sample content and is not an official guideline of the Society.`,
    "Үрэвсэлт гэдэсний өвчин",
    "Inflammatory bowel disease",
    `${year - 1}-11-20`,
    `${year - 1}-12-01`,
    `${year + 2}-12-01`,
  );
}

if (!await get("SELECT id FROM guidelines WHERE slug = 'demo-crc-screening'")) {
  await run(
    `INSERT INTO guidelines
       (id, slug, code, version, status, title_mn, title_en, summary_mn, summary_en,
        category_mn, category_en, approved_on)
     VALUES (?, 'demo-crc-screening', ?, '0.9', 'review', ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    `MSID-CG-${year}-02`,
    "Бүдүүн гэдэсний хорт хавдрын эрт илрүүлгийн зөвлөмж",
    "Recommendation on early detection of colorectal cancer",
    "Ажлын хэсгээс боловсруулж, удирдах зөвлөлийн хэлэлцүүлэгт өгсөн төсөл.",
    "A draft prepared by the working group and submitted to the executive board.",
    "Хорт хавдрын эрт илрүүлэг",
    "Cancer screening",
    `${year}-02-10`,
  );
}

/* -------------------------------------------------------------------------- */
/* Publication                                                                 */
/* -------------------------------------------------------------------------- */

if (!await get("SELECT id FROM publications WHERE slug = 'demo-ibd-registry'")) {
  await run(
    `INSERT INTO publications
       (id, slug, kind, status, title_mn, title_en, authors_mn, authors_en,
        abstract_mn, abstract_en, journal_mn, journal_en, volume, issue, pages, published_on)
     VALUES (?, 'demo-ibd-registry', 'article', 'published', ?, ?, ?, ?, ?, ?, ?, ?, '12', '3', '145-152', ?)`,
    newId(),
    "Монгол Улс дахь үрэвсэлт гэдэсний өвчний бүртгэлийн урьдчилсан дүн",
    "Preliminary results from the inflammatory bowel disease registry in Mongolia",
    "Судлаачдын нэр (жишээ)",
    "Author names (sample)",
    "Бүртгэлд хамрагдсан өвчтөнүүдийн нас, хүйс, оношийн хуваарилалт, эмчилгээний хандлагыг тодорхойлов. Энэ бол жишээ бичлэг юм.",
    "Age, sex, diagnostic distribution and treatment patterns among registered patients. This is a sample record.",
    "Монголын Анагаах Ухаан",
    "Mongolian Journal of Medicine",
    `${year - 1}-08-15`,
  );
}

/* -------------------------------------------------------------------------- */
/* News                                                                        */
/* -------------------------------------------------------------------------- */

if (!await get("SELECT id FROM news_posts WHERE slug = 'demo-news-congress-open'")) {
  await run(
    `INSERT INTO news_posts
       (id, slug, status, title_mn, title_en, excerpt_mn, excerpt_en, body_mn, body_en, published_at)
     VALUES (?, 'demo-news-congress-open', 'published', ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    `Их хурлын бүртгэл нээгдлээ`,
    `Congress registration is now open`,
    "Жил тутмын эрдэм шинжилгээний их хурлын бүртгэл эхэллээ. Хөнгөлөлттэй үнэ хязгаарлагдмал хугацаанд үйлчилнэ.",
    "Registration for the annual scientific congress has opened. Early-bird rates apply for a limited period.",
    `Нийгэмлэгийн жил тутмын эрдэм шинжилгээний их хурлын бүртгэл нээгдлээ. Гишүүд хөнгөлөлттэй үнээр оролцох боломжтой.

Илтгэлийн хураангуйг тогтоосон хугацаанд хүлээн авна. Дэлгэрэнгүй мэдээллийг арга хэмжээний хуудаснаас үзнэ үү.

Тайлбар: энэ бол жишээ мэдээ юм.`,
    `Registration for the Society's annual scientific congress is now open. Members are eligible for a reduced rate.

Abstracts are accepted until the published deadline. Full details are on the event page.

Note: this is a sample news item.`,
    new Date().toISOString().slice(0, 19).replace("T", " "),
  );
}

/* -------------------------------------------------------------------------- */
/* Board                                                                       */
/* -------------------------------------------------------------------------- */

const board: [string, string, string, string, number][] = [
  ["Тэргүүн", "President", "Нэр оруулаагүй", "Name not yet published", 1],
  ["Дэд тэргүүн", "Vice-president", "Нэр оруулаагүй", "Name not yet published", 2],
  ["Нарийн бичгийн дарга", "Secretary", "Нэр оруулаагүй", "Name not yet published", 3],
];

for (const [roleMn, roleEn, nameMn, nameEn, sort] of board) {
  if (await get("SELECT id FROM board_members WHERE role_en = ? AND bio_en LIKE 'DEMO%'", roleEn)) {
    continue;
  }
  await run(
    `INSERT INTO board_members
       (id, name_mn, name_en, role_mn, role_en, institution_mn, institution_en, bio_mn, bio_en, is_current, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    newId(),
    nameMn,
    nameEn,
    roleMn,
    roleEn,
    "Улсын клиникийн төв эмнэлэг",
    "State Central Clinical Hospital",
    "ЖИШЭЭ бичлэг. Удирдлагын хэсгээс жинхэнэ мэдээллээр солино уу.",
    "DEMO record. Replace with the real board member in the admin.",
    sort,
  );
}

console.log("Sample content added. Remove it with:  npm run demo:clear");
