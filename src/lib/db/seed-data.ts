// Relative imports with explicit extensions, not the `@/` alias: `npm run seed` runs
// this module through plain Node, which has no knowledge of the tsconfig path mapping.
import { newId, type Tx } from "./index.ts";
import { hashPassword } from "../auth/password.ts";
import { SETTING_DEFAULTS } from "../settings-defaults.ts";

/**
 * First-run content, and the routine that applies it.
 *
 * Lives here rather than in `scripts/seed.mts` because a serverless deployment has no
 * entrypoint to run a script from — Vercel builds and serves, it never executes
 * `npm run seed`. Worse, `vercel env pull` writes the literal string `[SENSITIVE]` in
 * place of encrypted values, so the credentials needed to seed from a laptop cannot be
 * retrieved at all. The application therefore seeds itself on first connection.
 *
 * Every statement is idempotent and the work is skipped once content exists, so this
 * costs one `COUNT(*)` per cold start and nothing else.
 *
 * The content below is deliberately not re-indented: it is mostly template literals
 * whose blank lines separate paragraphs, and indenting them would put whitespace on
 * those lines and break paragraph splitting.
 */

/* eslint-disable */
async function applyContent(tx: Tx): Promise<void> {
/**
 * The mission text is MSID's own wording, published by the Society on 17 May.
 * The English is a faithful translation of it, not a separate claim.
 */
const MISSION_MN = `Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэг (MSID) нь гэдэсний эмгэгийн судалгаа, оношилгоо, эмчилгээ, сургалт, мэдээлэл, стратегийн хөгжлийг олон улсын жишигт нийцүүлэн хөгжүүлэхийг зорин ажиллаж байна.

Бид гишүүн эмч, эрүүл мэндийн мэргэжилтнүүдтэйгээ хамтран судалгаанд суурилсан мэдлэгийг түгээж, эмнэлгийн тусламж үйлчилгээний чанарыг сайжруулах, олон нийтэд зөв, найдвартай мэдээлэл хүргэх замаар нийгмийн эрүүл мэндэд хувь нэмэр оруулахыг эрхэмлэнэ.`;

const MISSION_EN = `The Mongolian Society of Intestinal Disease (MSID) works to develop the research, diagnosis, treatment, training, information and strategic development of intestinal disease in line with international standards.

Together with our member physicians and health professionals, we disseminate evidence-based knowledge, improve the quality of clinical care, and contribute to public health by bringing accurate and reliable information to the wider community.`;

const WELCOME_MN = `Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэгийн цахим хуудсанд тавтай морилно уу.

Манай нийгэмлэг 2024 оны 3 дугаар сарын 5-ны өдөр гэдэсний эмгэг судлалыг Монгол Улсад системтэй хөгжүүлэх зорилгоор холбогдох мэргэжлийн эмч нарын санаачилгаар байгуулагдсан.

Энэхүү цахим хуудас нь нийгэмлэгээс баталсан эмнэлзүйн заавар, зөвлөмж, эрдэм шинжилгээний бүтээл, сургалт, их хурлын мэдээллийг нэгтгэн олон нийтэд хүргэх зорилготой.`;

const WELCOME_EN = `Welcome to the website of the Mongolian Society of Intestinal Disease.

The Society was founded on 5 March 2024 on the initiative of specialist physicians, to develop the study of intestinal disease in Mongolia systematically.

This site brings together the clinical guidelines and recommendations approved by the Society, its scientific work, and information on its training courses and congresses.`;

const HISTORY_INTRO_MN = `Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэгийн түүхэн замнал.`;
const HISTORY_INTRO_EN = `The history of the Mongolian Society of Intestinal Disease.`;

const COLLAB_INTRO_MN = `Нийгэмлэг гэдэсний эмгэг, ялангуяа үрэвсэлт гэдэсний өвчний (ҮГӨ) чиглэлээр ажилладаг олон улсын мэргэжлийн байгууллагуудтай хамтран ажиллаж, гишүүддээ мэдлэг, туршлага солилцох боломжийг бүрдүүлэхийг зорьдог.`;
const COLLAB_INTRO_EN = `The Society works with international professional organisations in intestinal disease — particularly inflammatory bowel disease (IBD) — to give its members access to shared knowledge and experience.`;

const GUIDELINES_INTRO_MN = `Энэ хэсэгт нийгэмлэгийн ажлын хэсгүүдээс боловсруулж, удирдах зөвлөлөөс баталсан эмнэлзүйн заавар, зөвшилцлийн баримт бичгийг байршуулна. Баримт бүрийн код, хувилбар, батлагдсан огноо, хүчин төгөлдөр байдлыг тэмдэглэсэн болно.`;
const GUIDELINES_INTRO_EN = `This section holds the clinical guidelines and consensus documents developed by the Society's working groups and approved by its executive board. Each document carries its code, version, approval date and current standing.`;

const PUBLICATIONS_INTRO_MN = `Нийгэмлэгийн гишүүдийн эрдэм шинжилгээний нийтлэл, судалгааны тайлан, хурлын эмхэтгэлийн бүртгэл.`;
const PUBLICATIONS_INTRO_EN = `A register of scientific articles, research reports and conference proceedings by members of the Society.`;

const MEMBERSHIP_INTRO_MN = `Гэдэсний эмгэг судлалын чиглэлээр ажиллаж буй эмч, эрдэмтэн, эрүүл мэндийн ажилтнуудыг нийгэмлэгийн гишүүнээр элсэхийг урьж байна. Хүсэлтийг удирдах зөвлөл хянан үзэж, хариуг и-мэйлээр мэдэгдэнэ.`;
const MEMBERSHIP_INTRO_EN = `Physicians, researchers and health professionals working in intestinal disease are invited to join the Society. Applications are reviewed by the executive board, and applicants are notified by email.`;

const MEMBERSHIP_BENEFITS_MN = `Нийгэмлэгийн их хурал, сургалтад хөнгөлөлттэй үнээр оролцох

Эмнэлзүйн заавар, зөвлөмжийн шинэчлэлийн талаар эхэнд мэдээлэл авах

Кейс хэлэлцүүлэг, олон улсын хамтарсан арга хэмжээнд оролцох

Нийгэмлэгийн ажлын хэсэг, судалгааны төсөлд нэр дэвших`;

const MEMBERSHIP_BENEFITS_EN = `Reduced rates at the Society's congresses and training courses

Early notice of new and revised clinical guidelines

Participation in case conferences and joint international activities

Eligibility to join the Society's working groups and research projects`;

/*
  The Society's call for abstracts, as supplied on 2 September 2026 for the training
  course of 18-19 September. The dates in it are the ones that change each year, which
  is why this is a `pages` row an administrator edits rather than page code; migration
  `2026-09-02-abstracts-call-2026` carries the same text to databases that were seeded
  with the placeholder this replaced.
*/
const ABSTRACTS_MN = `Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэг, Монголын Гастроэнтерологийн Холбоо, Улсын Нэгдүгээр Төв Эмнэлэг, АШУҮИС-ийн Хоол Боловсруулах Эрхтэн Судлалын Төв (ХБЭСТ) хамтран 2026 оны 9 дүгээр сарын 18, 19-ний өдрүүдэд «Гэдэсний үрэвсэлт эмгэгийн оношилгоо, эмчилгээний менежмент, дурангийн аюулгүй ажиллагаа, халдваргүйтгэл 2026» сэдэвт сургалт зохион байгуулна. Сургалтын үеэр гэдэсний эмгэг судлалын чиглэлээр хийсэн судалгааны илтгэлүүдийг хэлэлцүүлэхээр төлөвлөж байгаа тул эрдэм шинжилгээний илтгэл, тохиолдлын танилцуулгын хураангуйг хүлээн авч байна.

Эмч, судлаач та бүхнийг судалгааны ажлын үр дүн, сонин бөгөөд төвөгтэй тохиолдлынхоо талаар танилцуулж, мэргэжил нэгтнүүдтэйгээ мэдлэг, туршлагаа хуваалцахыг урьж байна.

Хураангуй хүлээн авах хугацаа: 2026 оны 8 дугаар сарын 27-ноос 9 дүгээр сарын 7-ны 23:59 цаг хүртэл.
Сонгон шалгаруулалтын хариу мэдэгдэх хугацаа: 2026 оны 9 дүгээр сарын 11.
Хүлээн авах хаяг: ibdmsid@gmail.com
Холбоо барих утас: 9907 5158

Илтгэлийн хураангуйд тавигдах шаардлага

1. Хэл – монгол.
2. Үгийн тоо – 250-аас хэтрэхгүй. Гарчиг, зохиогчдын нэр, байгууллагын мэдээлэл, түлхүүр үг үгийн тоонд орохгүй.
3. Бүтэц – үндэслэл, зорилго, материал арга зүй, үр дүн, дүгнэлт.
4. Гарчиг – судалгааны агуулгыг тодорхой илэрхийлсэн, товч байна.
5. Зохиогчид – зохиогчдын харьяалах байгууллагыг тодорхой бичнэ.
6. Үр дүн – хураангуй судалгааны бодит үр дүнг агуулсан байх бөгөөд үндсэн үр дүнг тоон болон статистикийн үзүүлэлтээр илэрхийлнэ.
7. Товчлол – стандарт бус товчлолыг анх хэрэглэхдээ бүтэн нэрийг бичиж, хаалтад товчлолыг тэмдэглэнэ.

Эмнэлзүйн тохиолдлын танилцуулгын загвар

Тохиолдлын танилцуулгыг SOAP (subjective, objective, assessment, plan) загвараар бэлтгэнэ. Бичиглэлд тавигдах шаардлага илтгэлийн хураангуйнхтай ижил.

Subjective – өвчний ба амьдралын түүх, харшил, мэс заслын болон бусад түүх.
Objective – амин үзүүлэлт, бодит үзлэгээр илэрсэн өөрчлөлт, лаборатори ба багажийн шинжилгээний өөрчлөлт, дүгнэлт.
Assessment – онош, ялган оношилгоо.
Plan – шаардлагатай оношилгоо, эмчилгээ, зөвлөгөө, өвчтөн, асран хамгаалагч болон эмнэлгийн мэргэжилтнүүдийн хамтын ажиллагааны төлөвлөгөө.`;

const ABSTRACTS_EN = `The Mongolian Society of Intestinal Disease, the Mongolian Gastroenterology Association, the First Central Hospital of Mongolia and the Centre for the Study of Digestive Organs at the Mongolian National University of Medical Sciences are holding a training course on 18 and 19 September 2026: «Inflammatory bowel disease: diagnosis, treatment management, endoscopy safety and disinfection 2026». Research presentations in intestinal disease will be discussed during the course, and abstracts for scientific presentations and case reports are now being accepted.

Physicians and researchers are invited to present the results of their work, and their unusual or difficult cases, and to share what they know with colleagues.

Abstracts are accepted from 27 August to 7 September 2026, 23:59.
Selection results are announced on 11 September 2026.
Send abstracts to: ibdmsid@gmail.com
Enquiries: 9907 5158

Requirements for a scientific abstract

1. Language – Mongolian.
2. Length – no more than 250 words. The title, the names of the authors, their institutional details and the keywords are not counted.
3. Structure – background, objective, materials and methods, results, conclusion.
4. Title – brief, and a clear statement of what the study is about.
5. Authors – state the institution each author belongs to.
6. Results – the abstract must carry the actual results of the study, with the principal findings given as figures and statistics.
7. Abbreviations – write a non-standard abbreviation out in full where it first appears, with the abbreviation in parentheses.

Case report format

Case reports follow the SOAP structure (subjective, objective, assessment, plan). The writing requirements are the same as for a scientific abstract.

Subjective – the history of the illness and of the patient, allergies, previous surgery and other history.
Objective – vital signs, the findings on examination, laboratory and imaging findings, and their interpretation.
Assessment – diagnosis and differential diagnosis.
Plan – the investigation, treatment and advice required, and the plan agreed between the patient, the carer and the clinical team.`;

const HOME_ABOUT_MN = `Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэг нь 2024 оны 3 дугаар сарын 5-ны өдөр байгуулагдсан төрийн бус байгууллага юм. Нийгэмлэг гэдэсний эмгэгийн оношилгоо, эмчилгээний чанарыг сайжруулах, эмнэлзүйн зааврыг боловсруулах, мэргэжлийн боловсон хүчнийг бэлтгэх чиглэлээр ажилладаг.`;
const HOME_ABOUT_EN = `The Mongolian Society of Intestinal Disease is a non-governmental organisation founded on 5 March 2024. It works to improve the diagnosis and treatment of intestinal disease, to develop clinical guidelines, and to train specialists in the field.`;

const PAGES: {
  key: string;
  title_mn: string;
  title_en: string;
  body_mn: string;
  body_en: string;
}[] = [
  {
    key: "about.welcome",
    title_mn: "Мэндчилгээ",
    title_en: "Welcome message",
    body_mn: WELCOME_MN,
    body_en: WELCOME_EN,
  },
  {
    key: "about.history",
    title_mn: "Түүх",
    title_en: "History",
    body_mn: HISTORY_INTRO_MN,
    body_en: HISTORY_INTRO_EN,
  },
  {
    key: "about.mission",
    title_mn: "Эрхэм зорилго, алсын хараа",
    title_en: "Mission & vision",
    body_mn: MISSION_MN,
    body_en: MISSION_EN,
  },
  {
    key: "about.board",
    title_mn: "Удирдах зөвлөл",
    title_en: "Executive board",
    body_mn: "",
    body_en: "",
  },
  {
    key: "about.contact",
    title_mn: "Холбоо барих",
    title_en: "Contact",
    body_mn: "",
    body_en: "",
  },
  {
    key: "collaboration.intro",
    title_mn: "Хамтын ажиллагаа",
    title_en: "Collaboration",
    body_mn: COLLAB_INTRO_MN,
    body_en: COLLAB_INTRO_EN,
  },
  {
    key: "guidelines.intro",
    title_mn: "Эмнэлзүйн заавар",
    title_en: "Clinical guidelines",
    body_mn: GUIDELINES_INTRO_MN,
    body_en: GUIDELINES_INTRO_EN,
  },
  {
    key: "publications.intro",
    title_mn: "Эрдэм шинжилгээний бүтээл",
    title_en: "Publications",
    body_mn: PUBLICATIONS_INTRO_MN,
    body_en: PUBLICATIONS_INTRO_EN,
  },
  {
    key: "membership.intro",
    title_mn: "Гишүүнчлэл",
    title_en: "Membership",
    body_mn: MEMBERSHIP_INTRO_MN,
    body_en: MEMBERSHIP_INTRO_EN,
  },
  {
    key: "membership.benefits",
    title_mn: "Гишүүний эрх",
    title_en: "Member benefits",
    body_mn: MEMBERSHIP_BENEFITS_MN,
    body_en: MEMBERSHIP_BENEFITS_EN,
  },
  {
    key: "home.about",
    title_mn: "Нийгэмлэгийн тухай",
    title_en: "About the Society",
    body_mn: HOME_ABOUT_MN,
    body_en: HOME_ABOUT_EN,
  },
  {
    key: "events.index",
    title_mn: "Арга хэмжээ, хөтөлбөр",
    title_en: "Events & Programmes",
    body_mn: "Их хурал, эрдэм шинжилгээний хурал, сургалт, кейс хэлэлцүүлэг.",
    body_en: "Congress, scientific meetings, training courses and case conferences.",
  },
  {
    key: "events.past",
    title_mn: "Өнгөрсөн арга хэмжээ",
    title_en: "Past events",
    body_mn: "",
    body_en: "",
  },
  {
    key: "news.index",
    title_mn: "Мэдээ, мэдээлэл",
    title_en: "News",
    body_mn: "",
    body_en: "",
  },
  {
    key: "events.abstracts",
    title_mn: "Илтгэлийн хураангуй хүлээн авах",
    title_en: "Abstract submission",
    body_mn: ABSTRACTS_MN,
    body_en: ABSTRACTS_EN,
  },
];

for (const page of PAGES) {
  await tx.run(
    `INSERT INTO pages (key, title_mn, title_en, body_mn, body_en) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(key) DO NOTHING`,
    page.key,
    page.title_mn,
    page.title_en,
    page.body_mn,
    page.body_en,
  );
}

/* -------------------------------------------------------------------------- */
/* History — the one dated fact MSID has published                             */
/* -------------------------------------------------------------------------- */

if (!await tx.get("SELECT id FROM history_entries LIMIT 1")) {
  await tx.run(
    `INSERT INTO history_entries (id, year, happened_on, title_mn, title_en, body_mn, body_en, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    2024,
    "2024-03-05",
    "Нийгэмлэг байгуулагдсан",
    "The Society is founded",
    "Гэдэсний эмгэг судлалыг системтэй хөгжүүлэх зорилгоор холбогдох мэргэжлийн эмч нарын санаачилгаар Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэг байгуулагдав.",
    "The Mongolian Society of Intestinal Disease was founded on the initiative of specialist physicians, to develop the study of intestinal disease systematically.",
    0,
  );
}

/* -------------------------------------------------------------------------- */
/* Partner organisations MSID publicly links to                                */
/* -------------------------------------------------------------------------- */

/*
  Foreign organisations carry an empty `name_mn` on purpose — the Society's decision of
  18 August 2026 is that their names appear in English on both language versions of the
  site, and `tr()` falls back to `name_en` when the Mongolian column is empty. Mongolian
  organisations get both names. Logos are `/brand/partner-*.png`, static files in the
  repo, for the six added on 18 August; the first four were uploaded to Blob by
  `scripts/import-partner-logos.mts` and keep whatever the administrator set. An
  admin upload replaces either.
*/
const PARTNERS = [
  {
    name_mn: "",
    name_en: "Korean Association for the Study of Intestinal Diseases",
    acronym: "KASID",
    country_mn: "Бүгд Найрамдах Солонгос Улс",
    country_en: "Republic of Korea",
    url: "https://eng.kasid.org",
    description_mn:
      "1980-аад оноос үйл ажиллагаагаа явуулж буй Солонгосын гэдэсний эмгэг судлалын мэргэжлийн нийгэмлэг. Intestinal Research сэтгүүлийг эрхлэн гаргадаг.",
    description_en:
      "The Korean professional society for the study of intestinal diseases, and publisher of the journal Intestinal Research.",
    kind: "society",
    sort: 1,
  },
  {
    name_mn: "",
    name_en: "Asian Organization for Crohn's and Colitis",
    acronym: "AOCC",
    country_mn: "Ази, Номхон далайн бүс",
    country_en: "Asia-Pacific",
    url: "https://www.aocc-ibd.org",
    description_mn:
      "Ази, Номхон далайн бүсийн үрэвсэлт гэдэсний өвчний судалгаа, эмнэлзүйн практикийг уялдуулан хөгжүүлэх зорилготой байгууллага.",
    description_en:
      "The Asia-Pacific organisation coordinating research and clinical practice in inflammatory bowel disease.",
    kind: "society",
    sort: 2,
  },
  {
    name_mn: "",
    name_en: "European Crohn's and Colitis Organisation",
    acronym: "ECCO",
    country_mn: "Европ",
    country_en: "Europe",
    url: "https://www.ecco-ibd.eu",
    description_mn:
      "Үрэвсэлт гэдэсний өвчний эмнэлзүйн заавар боловсруулж, сургалт судалгааг дэмждэг Европын мэргэжлийн байгууллага.",
    description_en:
      "The European professional organisation that develops IBD clinical guidelines and supports training and research.",
    kind: "society",
    sort: 3,
  },
  /* Added 18 August 2026 at the Society's request. */
  {
    name_mn: "Анагаахын Шинжлэх Ухааны Үндэсний Их Сургууль",
    name_en: "Mongolian National University of Medical Sciences",
    acronym: "MNUMS",
    logo: "/brand/partner-mnums.png",
    country_mn: "Монгол Улс",
    country_en: "Mongolia",
    url: "https://www.mnums.edu.mn",
    description_mn:
      "1942 онд байгуулагдсан, Монгол Улсын анагаах ухааны боловсрол, судалгааны тэргүүлэх их сургууль.",
    description_en:
      "Founded in 1942, Mongolia's leading university for medical education and research.",
    kind: "academic",
    sort: 5,
  },
  {
    name_mn: "",
    name_en: "National Taiwan University",
    acronym: "NTU",
    logo: "/brand/partner-ntu.png",
    country_mn: "Тайвань",
    country_en: "Taiwan",
    url: "https://www.ntu.edu.tw",
    description_mn: "",
    description_en: "",
    kind: "academic",
    sort: 6,
  },
  {
    name_mn: "Монголын Гастроэнтерологийн Холбоо",
    name_en: "Mongolian Gastroenterology Association",
    acronym: "MGA",
    logo: "/brand/partner-mga.png",
    country_mn: "Монгол Улс",
    country_en: "Mongolia",
    url: "",
    description_mn: "",
    description_en: "",
    kind: "society",
    sort: 7,
  },
  {
    name_mn: "УБ Сонгдо эмнэлэг",
    name_en: "UB Songdo Hospital",
    acronym: "Songdo",
    logo: "/brand/partner-songdo.png",
    country_mn: "Монгол Улс",
    country_en: "Mongolia",
    url: "https://www.songdo.mn",
    description_mn: "Bumrungrad Health Network-ийн гишүүн, Улаанбаатар хотын хувийн эмнэлэг.",
    description_en: "A private hospital in Ulaanbaatar and a member of the Bumrungrad Health Network.",
    kind: "hospital",
    sort: 8,
  },
  {
    name_mn: "Интермед эмнэлэг",
    name_en: "Intermed Hospital",
    acronym: "Intermed",
    logo: "/brand/partner-intermed.png",
    country_mn: "Монгол Улс",
    country_en: "Mongolia",
    url: "https://www.intermed.mn",
    description_mn: "",
    description_en: "",
    kind: "hospital",
    sort: 9,
  },
  {
    name_mn: "Н. Гэндэнжамцын нэрэмжит Эх Хүүхдийн Эрүүл Мэндийн Үндэсний Төв",
    name_en: "National Center for Maternal and Child Health",
    acronym: "NCMCH",
    logo: "/brand/partner-ncmch.png",
    country_mn: "Монгол Улс",
    country_en: "Mongolia",
    url: "https://www.ncmch.gov.mn",
    description_mn: "",
    description_en: "",
    kind: "hospital",
    sort: 10,
  },
];

for (const partner of PARTNERS) {
  if (await tx.get("SELECT id FROM partners WHERE acronym = ?", partner.acronym)) continue;
  await tx.run(
    `INSERT INTO partners
       (id, name_mn, name_en, acronym, country_mn, country_en, url, logo,
        description_mn, description_en, kind, sort)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId(),
    partner.name_mn,
    partner.name_en,
    partner.acronym,
    partner.country_mn,
    partner.country_en,
    partner.url,
    ("logo" in partner && partner.logo) || "",
    partner.description_mn,
    partner.description_en,
    partner.kind,
    partner.sort,
  );
}
}
/* eslint-enable */

/**
 * Applies first-run content and creates the first administrator.
 * Returns what it did, so the CLI can report it and the runtime can log it.
 */
export async function seedDatabase(tx: Tx): Promise<{
  seededContent: boolean;
  createdAdmin: string | null;
}> {
  const existingPages = await tx.get<{ n: number }>("SELECT COUNT(*) AS n FROM pages");
  const seededContent = Number(existingPages?.n ?? 0) === 0;

  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await tx.run(
      "INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
      key,
      value,
    );
  }

  await applyContent(tx);

  /*
    The administrator comes from ADMIN_EMAIL / ADMIN_PASSWORD, which on Vercel are
    ordinary runtime variables. Created only when that address has no account, so a
    password changed later is never reset back.
  */
  const adminEmail = (process.env.ADMIN_EMAIL ?? "admin@msid.mn").trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  let createdAdmin: string | null = null;

  const existingAdmin = await tx.get<{ id: string }>(
    "SELECT id FROM users WHERE email = ?",
    adminEmail,
  );

  if (!existingAdmin && adminPassword.length >= 10) {
    const id = newId();
    await tx.run(
      `INSERT INTO users (id, email, password_hash, role, status, name_mn, name_en)
       VALUES (?, ?, ?, 'admin', 'active', ?, ?)`,
      id,
      adminEmail,
      await hashPassword(adminPassword),
      "Системийн администратор",
      "Site administrator",
    );
    createdAdmin = adminEmail;
  }

  return { seededContent, createdAdmin };
}
