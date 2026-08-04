/**
 * Imports MSID's real executive board, and the facts about the Society that were
 * standing in as placeholders.
 *
 *   npm run import:board                       # local database
 *   TURSO_DATABASE_URL=… TURSO_AUTH_TOKEN=… npm run import:board   # production
 *
 * Idempotent: matched on the English name, so re-running updates rather than
 * duplicates. Safe to run again after correcting a spelling here.
 *
 * MONGOLIAN NAMES. The source list is in the English order — given name, then the
 * patronymic initial ("Bayarmaa O."). Mongolian writes the initial first, attached to
 * the given name with no space: "О.Баярмаа". Both forms are stored, one per column, so
 * each language shows the convention its readers expect.
 *
 * All sixteen Cyrillic spellings were confirmed by a native speaker on 4 August 2026,
 * including the three that were originally guesses: Л.Саяамаа, Б.Цэвэлноров and
 * Б.Түвшинтөр.
 */

import { get, newId, run } from "../src/lib/db/index.ts";
import { mimeFor, storeFile } from "./lib/store-file.mts";

/**
 * Portraits, keyed by the English name so a photograph can be handed in for anyone on
 * the list without changing the script:
 *
 *   npm run import:board -- --photo "Bayarmaa O.=/path/portrait.jpg" --photo "Bat-Ulzii E.=..."
 */
const photoArgs = process.argv
  .map((arg, i) => (arg === "--photo" ? process.argv[i + 1] : null))
  .filter((value): value is string => Boolean(value))
  .map((pair) => {
    const at = pair.indexOf("=");
    return [pair.slice(0, at), pair.slice(at + 1)] as const;
  });

interface Member {
  nameMn: string;
  nameEn: string;
  degree: string;
  roleMn: string;
  roleEn: string;
  institutionMn: string;
  institutionEn: string;
  bioMn: string;
  bioEn: string;
}

const MEMBER = { mn: "Удирдах зөвлөлийн гишүүн", en: "Board member" };

const BOARD: Member[] = [
  {
    nameMn: "О.Баярмаа",
    nameEn: "Bayarmaa O.",
    degree: "MD, PhD",
    roleMn: "Ерөнхийлөгч",
    roleEn: "President",
    institutionMn: "Улсын нэгдүгээр төв эмнэлэг",
    institutionEn: "First Central Hospital of Mongolia",
    bioMn:
      "Анагаах ухааны доктор, Монгол Улсын төрийн соёрхолт, Хүний гавьяат эмч. Улсын нэгдүгээр төв эмнэлгийн Ходоод, гэдэсний төвийн эрхлэгч.",
    bioEn:
      "State Prize laureate and Honoured Physician of Mongolia. Head, Gastroenterology Center, First Central Hospital of Mongolia.",
  },
  {
    nameMn: "Э.Бат-Өлзий",
    nameEn: "Bat-Ulzii E.",
    degree: "MD, MSc",
    roleMn: "Дэд ерөнхийлөгч",
    roleEn: "Vice President",
    institutionMn: "Улсын нэгдүгээр төв эмнэлэг",
    institutionEn: "First Central Hospital of Mongolia",
    bioMn: "Улсын нэгдүгээр төв эмнэлгийн Бүдүүн, шулуун гэдэсний мэс заслын тасгийн эрхлэгч.",
    bioEn:
      "Head, Department of Colorectal Surgery, First Central Hospital of Mongolia.",
  },
  {
    nameMn: "Д.Ариунзул",
    nameEn: "Ariunzul D.",
    degree: "MD, MSc",
    roleMn: "Ерөнхий нарийн бичгийн дарга",
    roleEn: "Secretary General",
    institutionMn: "Улсын нэгдүгээр төв эмнэлэг",
    institutionEn: "First Central Hospital of Mongolia",
    bioMn: "Улсын нэгдүгээр төв эмнэлгийн Ходоод, гэдэсний төвийн ходоод гэдэсний эмч.",
    bioEn:
      "Gastroenterologist, Gastroenterology Center, First Central Hospital of Mongolia.",
  },
  {
    nameMn: "Д.Даваадорж",
    nameEn: "Davaadorj D.",
    degree: "MD, PhD, Professor",
    roleMn: MEMBER.mn,
    roleEn: MEMBER.en,
    institutionMn: "Анагаахын шинжлэх ухааны үндэсний их сургууль",
    institutionEn: "Mongolian National University of Medical Sciences",
    bioMn:
      "Монголын Ходоод, гэдэсний өвчин судлалын нийгэмлэгийн тэргүүн. АШУҮИС-ийн профессор.",
    bioEn:
      "President, Mongolian Gastroenterology Association. Professor, Mongolian National University of Medical Sciences (MNUMS).",
  },
  {
    nameMn: "Л.Ган-Орших",
    nameEn: "Gan-Orshikh L.",
    degree: "MD, MSc",
    roleMn: MEMBER.mn,
    roleEn: MEMBER.en,
    institutionMn: "Интермед эмнэлэг",
    institutionEn: "Intermed Hospital",
    bioMn: "Монголын Хоол боловсруулах эрхтний дурангийн нийгэмлэгийн тэргүүн.",
    bioEn: "President, Mongolian Society of Digestive Endoscopy.",
  },
  {
    nameMn: "Ц.Бямбажав",
    nameEn: "Byambajav Ts.",
    degree: "MD, PhD",
    roleMn: MEMBER.mn,
    roleEn: MEMBER.en,
    institutionMn: "Анагаахын шинжлэх ухааны үндэсний их сургууль",
    institutionEn: "Mongolian National University of Medical Sciences",
    bioMn:
      "АШУҮИС-ийн Анагаах ухааны сургуулийн Ходоод, гэдэс, элэг судлалын тэнхимийн эрхлэгч. Монгол-Японы эмнэлгийн Хоол боловсруулах эрхтний дурангийн тасгийн эрхлэгч.",
    bioEn:
      "Head, Department of Gastroenterology and Hepatology, School of Medicine, MNUMS. Head, Department of Gastrointestinal Endoscopy, Mongolia–Japan Hospital.",
  },
  {
    nameMn: "Н.Бира",
    nameEn: "Bira N.",
    degree: "MD, PhD, Professor",
    roleMn: MEMBER.mn,
    roleEn: MEMBER.en,
    institutionMn: "Анагаахын шинжлэх ухааны үндэсний их сургууль",
    institutionEn: "Mongolian National University of Medical Sciences",
    bioMn: "АШУҮИС-ийн профессор.",
    bioEn: "Professor, Mongolian National University of Medical Sciences (MNUMS).",
  },
  {
    nameMn: "Э.Баярмаа",
    nameEn: "Bayarmaa E.",
    degree: "MD, PhD, Professor",
    roleMn: MEMBER.mn,
    roleEn: MEMBER.en,
    institutionMn: "Анагаахын шинжлэх ухааны үндэсний их сургууль",
    institutionEn: "Mongolian National University of Medical Sciences",
    bioMn:
      "АШУҮИС-ийн Био-Анагаахын сургуулийн Эмгэг судлал, шүүх эмнэлгийн тэнхимийн эрхлэгч.",
    bioEn:
      "Head, Department of Pathology and Forensic Medicine, School of Biomedicine, MNUMS.",
  },
  {
    nameMn: "Б.Отгонжаргал",
    nameEn: "Otgonjargal B.",
    degree: "MD, PhD",
    roleMn: MEMBER.mn,
    roleEn: MEMBER.en,
    institutionMn: "Анагаахын шинжлэх ухааны үндэсний их сургууль",
    institutionEn: "Mongolian National University of Medical Sciences",
    bioMn:
      "АШУҮИС-ийн Био-Анагаахын сургуулийн Бичил амь судлал, халдвар хамгааллын тэнхимийн багш.",
    bioEn:
      "Lecturer, Department of Microbiology and Infection Prevention and Control, School of Biomedicine, MNUMS.",
  },
  {
    nameMn: "Д.Өлзий",
    nameEn: "Ulzii D.",
    degree: "MD, PhD",
    roleMn: MEMBER.mn,
    roleEn: MEMBER.en,
    institutionMn: "Монгол-Японы эмнэлэг",
    institutionEn: "Mongolia–Japan Hospital",
    bioMn:
      "Хүүхдийн ходоод, гэдэсний эмч. АШУҮИС-ийн Анагаах ухааны сургуулийн Хүүхдийн тэнхимийн багш.",
    bioEn:
      "Pediatric Gastroenterologist, Mongolia–Japan Hospital. Lecturer, Department of Pediatrics, School of Medicine, MNUMS.",
  },
  {
    nameMn: "Б.Эрдэнэцэцэг",
    nameEn: "Erdenetsetseg B.",
    degree: "MD, MSc",
    roleMn: MEMBER.mn,
    roleEn: MEMBER.en,
    institutionMn: "Улсын нэгдүгээр төв эмнэлэг",
    institutionEn: "First Central Hospital of Mongolia",
    bioMn: "Улсын нэгдүгээр төв эмнэлгийн Оношилгооны дүрс оношилгооны төвийн эмч.",
    bioEn:
      "Radiologist, Diagnostic Imaging Center, First Central Hospital of Mongolia.",
  },
  {
    nameMn: "Л.Баясгалан",
    nameEn: "Bayasgalan L.",
    degree: "MD, PhD",
    roleMn: MEMBER.mn,
    roleEn: MEMBER.en,
    institutionMn: "Улаанбаатар Сонгдо эмнэлэг",
    institutionEn: "Ulaanbaatar Songdo Hospital",
    bioMn:
      "Ходоод, гэдэс, дурангийн тасгийн эрхлэгч. Ходоод гэдэсний эмч, эмчилгээний дурангийн мэргэжилтэн.",
    bioEn:
      "Head, Department of Gastroenterology and Gastrointestinal Endoscopy. Gastroenterologist and therapeutic endoscopist.",
  },
  {
    nameMn: "Б.Хандмаа",
    nameEn: "Khandmaa B.",
    degree: "MD, MSc",
    roleMn: MEMBER.mn,
    roleEn: MEMBER.en,
    institutionMn: "Эх, хүүхдийн эрүүл мэндийн үндэсний төв",
    institutionEn: "National Center for Maternal and Child Health",
    bioMn: "Ходоод, гэдэс, дурангийн тасгийн эрхлэгч.",
    bioEn: "Head, Department of Gastroenterology and Endoscopy.",
  },
  {
    nameMn: "Л.Саяамаа",
    nameEn: "Sayamaa L.",
    degree: "PhD, Associate Professor",
    roleMn: MEMBER.mn,
    roleEn: MEMBER.en,
    institutionMn: "Анагаахын шинжлэх ухааны үндэсний их сургууль",
    institutionEn: "Mongolian National University of Medical Sciences",
    bioMn: "АШУҮИС-ийн Био-Анагаахын сургуулийн Физиологийн тэнхимийн эрхлэгч.",
    bioEn:
      "Head, Department of Physiology, School of Biomedicine, MNUMS.",
  },
  {
    nameMn: "Б.Цэвэлноров",
    nameEn: "Tsevelnorov B.",
    degree: "MD, PhD",
    roleMn: MEMBER.mn,
    roleEn: MEMBER.en,
    institutionMn: "Анагаахын шинжлэх ухааны үндэсний их сургууль",
    institutionEn: "Mongolian National University of Medical Sciences",
    bioMn:
      "АШУҮИС-ийн Анагаах ухааны сургуулийн Ходоод, гэдэс, дурангийн тэнхимийн багш.",
    bioEn:
      "Lecturer, Department of Gastroenterology and Endoscopy, School of Medicine, MNUMS.",
  },
  {
    nameMn: "Б.Түвшинтөр",
    nameEn: "Tuvshintur B.",
    degree: "MD, MSc",
    roleMn: MEMBER.mn,
    roleEn: MEMBER.en,
    institutionMn: "Улсын нэгдүгээр төв эмнэлэг",
    institutionEn: "First Central Hospital of Mongolia",
    bioMn: "Улсын нэгдүгээр төв эмнэлгийн Бүдүүн, шулуун гэдэсний мэс заслын тасгийн эмч.",
    bioEn:
      "Colorectal Surgeon, Department of Colorectal Surgery, First Central Hospital of Mongolia.",
  },
];

/* -------------------------------------------------------------------------- */

async function upsertMember(member: Member, sort: number): Promise<"created" | "updated"> {
  const existing = await get<{ id: string }>(
    "SELECT id FROM board_members WHERE name_en = ?",
    member.nameEn,
  );

  const columns = {
    name_mn: member.nameMn,
    name_en: member.nameEn,
    role_mn: member.roleMn,
    role_en: member.roleEn,
    degree: member.degree,
    institution_mn: member.institutionMn,
    institution_en: member.institutionEn,
    bio_mn: member.bioMn,
    bio_en: member.bioEn,
    /*
      No term_from. The Society was founded on 2024-03-05, but that is not evidence
      that each of these sixteen joined the board that day, and a date printed under a
      real person's name should be one somebody supplied rather than one inferred.
    */
    is_current: 1,
    sort,
  };

  if (existing) {
    const keys = Object.keys(columns);
    await run(
      `UPDATE board_members SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`,
      ...keys.map((k) => columns[k as keyof typeof columns]),
      existing.id,
    );
    return "updated";
  }

  const keys = Object.keys(columns);
  await run(
    `INSERT INTO board_members (id, ${keys.join(", ")})
     VALUES (?, ${keys.map(() => "?").join(", ")})`,
    newId(),
    ...keys.map((k) => columns[k as keyof typeof columns]),
  );
  return "created";
}

let created = 0;
let updated = 0;
for (const [index, member] of BOARD.entries()) {
  const outcome = await upsertMember(member, index + 1);
  outcome === "created" ? created++ : updated++;
}

/*
  The three seeded rows were shaped like the real board — Тэргүүн, Дэд тэргүүн, нарийн
  бичгийн дарга — but with no names in them, waiting for exactly this list. They are
  matched on the placeholder name so a real member can never be caught by it.
*/
const { changes: placeholders } = await run(
  "DELETE FROM board_members WHERE name_mn = 'Нэр оруулаагүй'",
);

for (const [name, path] of photoArgs) {
  const stored = await storeFile(path, mimeFor(path), "portrait");
  const { changes } = await run(
    "UPDATE board_members SET photo = ? WHERE name_en = ?",
    stored,
    name,
  );
  console.log(
    changes ? `  Portrait for ${name}: ${stored}` : `  No board member named "${name}"`,
  );
}

console.log(`  Board: ${created} created, ${updated} updated, ${placeholders} placeholders removed.`);


process.exit(0);
