import { createClient, type Client, type InValue } from "@libsql/client";
import { randomUUID } from "node:crypto";
import { SCHEMA } from "./schema.ts";

/**
 * Database access for the MSID site, over libSQL.
 *
 * libSQL *is* SQLite — same dialect, same schema — but reached over HTTP, which is what
 * makes it work on a serverless host where there is no persistent disk to keep a file
 * on. The same client talks to a local file in development, so `npm run dev` needs no
 * account and no network.
 *
 * Every helper is async. That is not incidental: a serverless database call is a
 * network round trip, and pretending otherwise is how you end up with a synchronous API
 * that cannot be implemented.
 *
 * Connection is chosen by environment:
 *   TURSO_DATABASE_URL + TURSO_AUTH_TOKEN  → hosted Turso (production)
 *   MSID_DB_PATH or the default            → local file (development, Docker volume)
 */

type Param = InValue;

function connectionConfig(): { url: string; authToken?: string } {
  const remote = process.env.TURSO_DATABASE_URL?.trim();
  if (remote) {
    return { url: remote, authToken: process.env.TURSO_AUTH_TOKEN?.trim() };
  }

  const path = process.env.MSID_DB_PATH?.trim() || "./data/msid.db";
  // `file:` URLs are relative to the process working directory.
  return { url: path.startsWith("file:") ? path : `file:${path}` };
}

/**
 * One client and one schema application per process, cached on `globalThis` so Next.js
 * hot reloading does not reconnect on every edit and a warm serverless instance does
 * not re-run the schema on every request.
 */
type GlobalWithDb = typeof globalThis & { __msidDb?: Promise<Client> };

/**
 * Storage settings that only mean anything for a local SQLite file.
 *
 * A hosted libSQL server manages its own durability and rejects these, so sending them
 * to Turso throws — and because the schema runs on connection, that failure surfaces as
 * every single page returning a 500.
 */
const LOCAL_PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
`;

/**
 * Ordered, additive migrations applied after the base schema.
 *
 * `schema.ts` is all `CREATE TABLE IF NOT EXISTS`, which does nothing to a table that
 * already exists — so a new column on a live database has to arrive as an `ALTER TABLE`
 * here. Append only; never edit or reorder an entry that has shipped, because applied
 * ids are recorded and skipped.
 */
const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: "2026-08-01-video-url",
    sql: `
      ALTER TABLE events ADD COLUMN video_url TEXT NOT NULL DEFAULT '';
      ALTER TABLE news_posts ADD COLUMN video_url TEXT NOT NULL DEFAULT '';
    `,
  },
  {
    id: "2026-08-01-login-attempts",
    sql: `
      CREATE TABLE IF NOT EXISTS login_attempts (
        id           TEXT PRIMARY KEY,
        identity     TEXT NOT NULL,
        attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(identity, attempted_at);
    `,
  },
  {
    id: "2026-08-02-password-resets",
    sql: `
      CREATE TABLE IF NOT EXISTS password_resets (
        token_hash TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        used_at    TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
    `,
  },
  {
    /*
      Photographs belong to the event they document, not to a gallery of their own.
      Attached this way each one inherits that event's date, place and name, so a
      caption never has to assert something nobody can verify — which is the whole
      difficulty with the Society's photographs.
    */
    id: "2026-08-05-event-photos",
    sql: `
      CREATE TABLE IF NOT EXISTS event_photos (
        id         TEXT PRIMARY KEY,
        event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        image      TEXT NOT NULL DEFAULT '',
        alt_mn     TEXT NOT NULL DEFAULT '',
        alt_en     TEXT NOT NULL DEFAULT '',
        caption_mn TEXT NOT NULL DEFAULT '',
        caption_en TEXT NOT NULL DEFAULT '',
        sort       INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_event_photos_event ON event_photos(event_id, sort);
    `,
  },
  {
    /*
      A photograph for the fixed prose pages. "Эрхэм зорилго, алсын хараа" and its
      siblings are a heading and four paragraphs, and the Society has photographs of
      the work those paragraphs describe; this puts one under the text without giving
      the admin a page builder to misuse. Optional everywhere — a page with no image
      renders exactly as it does now.
    */
    id: "2026-08-09-page-image",
    sql: `
      ALTER TABLE pages ADD COLUMN image TEXT NOT NULL DEFAULT '';
      ALTER TABLE pages ADD COLUMN image_alt_mn TEXT NOT NULL DEFAULT '';
      ALTER TABLE pages ADD COLUMN image_alt_en TEXT NOT NULL DEFAULT '';
    `,
  },
  {
    /*
      Three of the new partners are hospitals — UB Songdo, Intermed, the National
      Center for Maternal and Child Health — and none of the four kinds fitted them: a
      private hospital is not a government body and not a sponsor. SQLite cannot alter
      a CHECK constraint in place, so the table is rebuilt: same columns, one more
      allowed value. Nothing references `partners` by foreign key, so the swap is safe.
      `schema.ts` carries the new constraint for databases created after this.
    */
    id: "2026-08-18-partner-kind-hospital",
    sql: `
      CREATE TABLE partners_v2 (
        id             TEXT PRIMARY KEY,
        name_mn        TEXT NOT NULL DEFAULT '',
        name_en        TEXT NOT NULL DEFAULT '',
        acronym        TEXT NOT NULL DEFAULT '',
        country_mn     TEXT NOT NULL DEFAULT '',
        country_en     TEXT NOT NULL DEFAULT '',
        url            TEXT NOT NULL DEFAULT '',
        logo           TEXT NOT NULL DEFAULT '',
        description_mn TEXT NOT NULL DEFAULT '',
        description_en TEXT NOT NULL DEFAULT '',
        kind           TEXT NOT NULL DEFAULT 'society'
                         CHECK (kind IN ('society', 'academic', 'sponsor', 'government', 'hospital')),
        sort           INTEGER NOT NULL DEFAULT 0
      );
      INSERT INTO partners_v2 SELECT id, name_mn, name_en, acronym, country_mn, country_en,
        url, logo, description_mn, description_en, kind, sort FROM partners;
      DROP TABLE partners;
      ALTER TABLE partners_v2 RENAME TO partners;
    `,
  },
  {
    /*
      The Society's decision (18 August 2026): a foreign partner's name is shown in
      English on both language versions of the site — a transliterated or translated
      name is not what those organisations call themselves. `tr()` already falls back
      to the English column when the Mongolian one is empty, so the change is to the
      data: the three seeded translations are cleared. The seed no longer writes them.
    */
    id: "2026-08-18-foreign-partner-names-english",
    sql: `
      UPDATE partners SET name_mn = '' WHERE acronym IN ('KASID', 'AOCC', 'ECCO');
    `,
  },
  {
    /*
      The six partners added on 18 August were seeded before their marks were in the
      repo. The files now live in public/brand; this points each row at its file — only
      where the logo is still empty, so a mark an administrator has meanwhile uploaded
      is left alone. Same-origin paths, served as static assets on every host.
    */
    id: "2026-08-18-partner-logos",
    sql: `
      UPDATE partners SET logo = '/brand/partner-mnums.png'    WHERE acronym = 'MNUMS'    AND logo = '';
      UPDATE partners SET logo = '/brand/partner-ntu.png'      WHERE acronym = 'NTU'      AND logo = '';
      UPDATE partners SET logo = '/brand/partner-mga.png'      WHERE acronym = 'MGA'      AND logo = '';
      UPDATE partners SET logo = '/brand/partner-songdo.png'   WHERE acronym = 'Songdo'   AND logo = '';
      UPDATE partners SET logo = '/brand/partner-intermed.png' WHERE acronym = 'Intermed' AND logo = '';
      UPDATE partners SET logo = '/brand/partner-ncmch.png'    WHERE acronym = 'NCMCH'    AND logo = '';
    `,
  },
  {
    /*
      The Society's first call for abstracts, supplied 2 September 2026 by
      Dr Ariunzul Dashdondog: the training course of 18-19 September, and the rules for
      submitting to it. Two changes in one migration because they are one announcement.

      The page update is guarded on the placeholder text still being in place, so an
      administrator who has already written their own version is not overwritten. The
      event is guarded on its slug, so a second run, or an event an administrator
      created first, inserts nothing.

      The event carries `abstract_deadline`, which is what puts it in the "currently
      accepting" list on /events/abstracts and in the deadline block on its own page.
      It closes itself on 8 September with no further edit.
    */
    id: "2026-09-02-abstracts-call-2026",
    sql: `
      UPDATE pages SET
        body_mn = 'Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэг, Монголын Гастроэнтерологийн Холбоо, Улсын Нэгдүгээр Төв Эмнэлэг, АШУҮИС-ийн ХБЭСТ хамтран 2026 оны 9 дүгээр сарын 18, 19-ний өдрүүдэд «Гэдэсний үрэвсэлт эмгэгийн оношилгоо, эмчилгээний менежмент, дурангийн аюулгүй ажиллагаа, халдваргүйтгэл 2026» сэдэвт сургалт зохион байгуулна. Сургалтын үеэр гэдэсний эмгэг судлалын чиглэлээр хийсэн судалгааны илтгэлүүдийг хэлэлцүүлэхээр төлөвлөж байгаа тул эрдэм шинжилгээний илтгэл, тохиолдлын танилцуулгын хураангуйг хүлээн авч байна.

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
Plan – шаардлагатай оношилгоо, эмчилгээ, зөвлөгөө, өвчтөн, асран хамгаалагч болон эмнэлгийн мэргэжилтнүүдийн хамтын ажиллагааны төлөвлөгөө.',
        body_en = 'The Mongolian Society of Intestinal Disease, the Mongolian Gastroenterology Association, the First Central Hospital of Mongolia and the Mongolian National University of Medical Sciences are holding a training course on 18 and 19 September 2026: «Inflammatory bowel disease: diagnosis, treatment management, endoscopy safety and disinfection 2026». Research presentations in intestinal disease will be discussed during the course, and abstracts for scientific presentations and case reports are now being accepted.

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
Plan – the investigation, treatment and advice required, and the plan agreed between the patient, the carer and the clinical team.',
        updated_at = datetime('now')
      WHERE key = 'events.abstracts'
        AND body_mn LIKE 'Нийгэмлэг жил бүр эрдэм шинжилгээний хурал%';

      INSERT INTO events (
        id, slug, kind, status, title_mn, title_en, summary_mn, summary_en,
        body_mn, body_en, city_mn, city_en, starts_on, ends_on, abstract_deadline
      )
      SELECT
        '0198f3c4-6a21-4e77-9b0d-5c81e2a7d413',
        'ibd-endoscopy-2026',
        'training',
        'published',
        'Гэдэсний үрэвсэлт эмгэгийн оношилгоо, эмчилгээний менежмент, дурангийн аюулгүй ажиллагаа, халдваргүйтгэл 2026',
        'Inflammatory bowel disease: diagnosis, treatment management, endoscopy safety and disinfection 2026',
        'Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэг, Монголын Гастроэнтерологийн Холбоо, Улсын Нэгдүгээр Төв Эмнэлэг, АШУҮИС-ийн ХБЭСТ хамтран зохион байгуулах хоёр өдрийн сургалт.',
        'A two-day training course held jointly by the Mongolian Society of Intestinal Disease, the Mongolian Gastroenterology Association, the First Central Hospital of Mongolia and the Mongolian National University of Medical Sciences.',
        'Сургалтын үеэр гэдэсний эмгэг судлалын чиглэлээр хийсэн судалгааны илтгэлүүдийг хэлэлцүүлнэ. Эмч, судлаачдыг судалгааны ажлын үр дүн, сонин бөгөөд төвөгтэй тохиолдлынхоо талаар танилцуулж, мэргэжил нэгтнүүдтэйгээ мэдлэг, туршлагаа хуваалцахыг урьж байна.

Илтгэлийн хураангуй ирүүлэх журам, бичиглэлд тавигдах шаардлагыг «Илтгэл хүлээн авах» хуудсанд байрлуулав. Хураангуйг ibdmsid@gmail.com хаягаар хүлээн авна.

Хөтөлбөр, бүртгэлийн дэлгэрэнгүй мэдээллийг тодрох тусам энэ хуудсанд нийтэлнэ.',
        'Research presentations in intestinal disease are discussed during the course. Physicians and researchers are invited to present the results of their work, and their unusual or difficult cases, and to share what they know with colleagues.

The rules for submitting an abstract, and the format required, are on the Abstract submission page. Abstracts go to ibdmsid@gmail.com.

The programme and the registration details are published here as they are settled.',
        'Улаанбаатар',
        'Ulaanbaatar',
        '2026-09-18',
        '2026-09-19',
        '2026-09-07'
      WHERE NOT EXISTS (SELECT 1 FROM events WHERE slug = 'ibd-endoscopy-2026');
    `,
  },
  {
    /*
      ХБЭСТ written out: Хоол Боловсруулах Эрхтэн Судлалын Төв, the digestive-organ
      centre at АШУҮИС (confirmed by the Society, 2 September 2026). The call's own
      seventh requirement asks an author to spell a non-standard abbreviation out the
      first time it appears, so the announcement should meet the standard it sets.

      `replace()` on the one phrase rather than a rewrite of the whole body: an
      administrator may have edited the text since it shipped this morning, and there is
      no reason for a name correction to overwrite their work.
    */
    id: "2026-09-02-digestive-centre-name",
    sql: `
      UPDATE pages
         SET body_mn = replace(body_mn, 'АШУҮИС-ийн ХБЭСТ', 'АШУҮИС-ийн Хоол Боловсруулах Эрхтэн Судлалын Төв (ХБЭСТ)'),
             body_en = replace(body_en, 'and the Mongolian National University of Medical Sciences', 'and the Centre for the Study of Digestive Organs at the Mongolian National University of Medical Sciences'),
             updated_at = datetime('now')
       WHERE key = 'events.abstracts';

      UPDATE events
         SET summary_mn = replace(summary_mn, 'АШУҮИС-ийн ХБЭСТ', 'АШУҮИС-ийн Хоол Боловсруулах Эрхтэн Судлалын Төв (ХБЭСТ)'),
             summary_en = replace(summary_en, 'and the Mongolian National University of Medical Sciences', 'and the Centre for the Study of Digestive Organs at the Mongolian National University of Medical Sciences'),
             updated_at = datetime('now')
       WHERE slug = 'ibd-endoscopy-2026';
    `,
  },
  {
    /*
      A banner per section, so the Society can put its own photograph behind each page
      title rather than one image behind all of them. The column is on `pages` because
      that is where an administrator already edits a section's words, and an empty value
      falls back to the shared `section_banner` setting.

      Three section landings never had a `pages` row - the events index, past events and
      news are lists, not prose - which left them with nothing to hang a banner on. They
      get one here, seeded with the wording the dictionary already showed, so nothing
      changes on the page until someone edits it. Their titles and intros become editable
      as a consequence, which is the point of the pages table.
    */
    id: "2026-09-02-page-banners",
    sql: `
      ALTER TABLE pages ADD COLUMN banner TEXT NOT NULL DEFAULT '';

      INSERT INTO pages (key, title_mn, title_en, body_mn, body_en)
      VALUES (
        'events.index',
        'Арга хэмжээ, хөтөлбөр',
        'Events & Programmes',
        'Их хурал, эрдэм шинжилгээний хурал, сургалт, кейс хэлэлцүүлэг.',
        'Congress, scientific meetings, training courses and case conferences.'
      ) ON CONFLICT(key) DO NOTHING;

      INSERT INTO pages (key, title_mn, title_en, body_mn, body_en)
      VALUES ('events.past', 'Өнгөрсөн арга хэмжээ', 'Past events', '', '')
      ON CONFLICT(key) DO NOTHING;

      INSERT INTO pages (key, title_mn, title_en, body_mn, body_en)
      VALUES ('news.index', 'Мэдээ, мэдээлэл', 'News', '', '')
      ON CONFLICT(key) DO NOTHING;
    `,
  },
  {
    /*
      The Society chose a different photograph on 2 September: the Altai steppe under
      snow-topped mountains, by Bolatbek Gabiden on Unsplash. Both settings already hold
      the escarpment in the live database, and a stored value wins over a default, so
      the new default in settings-defaults.ts would never have reached them.

      Guarded on the old path, so an administrator who has since chosen something of
      their own keeps it. The escarpment stays in the repo and stays selectable.
    */
    id: "2026-09-02-steppe-altai-ground",
    sql: `
      UPDATE site_settings SET value = '/brand/steppe-altai.jpg', updated_at = datetime('now')
       WHERE key IN ('hero_background', 'section_banner')
         AND value = '/brand/hero-bg.jpg';
    `,
  },
  {
    /*
      The previous migration overreached: the Society asked whether the Altai photograph
      could be used, and the answer belonged to the interior page banners, not to the
      hero, whose escarpment had been chosen and its shadow tuned over four rounds.

      The hero goes back. The banner keeps the new photograph, which is what was being
      discussed — and the two pages now open on different pictures, which is better than
      what either state had.
    */
    id: "2026-09-02-hero-back-to-escarpment",
    sql: `
      UPDATE site_settings SET value = '/brand/hero-bg.jpg', updated_at = datetime('now')
       WHERE key = 'hero_background'
         AND value = '/brand/steppe-altai.jpg';
    `,
  },
  {
    /*
      The terms a card-acquiring bank requires before it will connect a payment gateway:
      what is sold, how it reaches the buyer, the currency and terms of payment, and when
      money is returned. The Society is applying to Trade and Development Bank, whose
      checklist asks for each of these to be published and findable.

      Seeded as ordinary pages so the Society edits the wording in the admin like any
      other text. The refund windows below are a starting draft, not the board's
      decision: 14 days for a full refund, 7 to 13 days for half, nothing inside a week.
      They are the common shape for a medical training course and they are conservative,
      but they must be confirmed before the bank reviews the site, and the Society is
      free to change them — the headings on /terms are fixed in code, the terms are not.

      Written with no apostrophes so the SQL needs no escaping.
    */
    id: "2026-09-04-terms-of-service",
    sql: `
      INSERT INTO pages (key, title_mn, title_en, body_mn, body_en) VALUES (
        'terms.service',
        'Үйлчилгээний танилцуулга',
        'What the Society sells',
        'Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэг нь цахим хуудсаараа дамжуулан дараах үйлчилгээний төлбөрийг хүлээн авна:

Сургалт, эрдэм шинжилгээний хурал, чуулганы оролцооны бүртгэл. Арга хэмжээ тус бүрийн хөтөлбөр, товч агуулга, огноо, байршил, оролцооны төлбөрийг тухайн арга хэмжээний хуудсанд урьдчилан бүрэн нийтэлнэ.
Нийгэмлэгийн гишүүнчлэл. Элсэх болзол, гишүүний эрх, жилийн татварын хэмжээг Гишүүнчлэл хуудсанд нийтэлнэ.

Худалдан авалт бүр нэг тодорхой арга хэмжээ, эсхүл тодорхой хугацааны гишүүнчлэлд хамаарна. Оролцогч төлбөр хийхээсээ өмнө үнэ, агуулга, хугацааг бүрэн харах боломжтой байна.',
        'The Mongolian Society of Intestinal Disease accepts payment through this website for:

Registration for training courses, scientific meetings and congresses. Each event page publishes the programme, dates, venue and participation fee in full before registration.
Membership of the Society. The conditions of admission, the rights of members and the annual subscription are published on the Membership page.

Every purchase relates to one named event or to membership for a stated period. The price, what it includes and the dates are shown in full before any payment is made.'
      ) ON CONFLICT(key) DO NOTHING;

      INSERT INTO pages (key, title_mn, title_en, body_mn, body_en) VALUES (
        'terms.delivery',
        'Хүргэлтийн нөхцөл',
        'Delivery',
        'Нийгэмлэгийн үйлчилгээ нь биет бараа биш тул шуудан, хүргэлтийн үйлчилгээ хамаарахгүй.

Төлбөр баталгаажсанаас хойш ажлын нэг өдрийн дотор бүртгэл баталгаажсан мэдэгдлийг бүртгүүлэхдээ оруулсан цахим шуудангийн хаягаар илгээнэ. Мэдэгдэлд бүртгэлийн дугаар, арга хэмжээний нэр, огноо, байршил багтана.
Арга хэмжээнд оролцох эрх нь зарлагдсан огноо, байршилд хүчинтэй. Танхимын арга хэмжээнд бүртгэлийн дугаараар, цахим арга хэмжээнд урьдчилан илгээсэн холбоосоор оролцоно.
Гэрчилгээ олгохоор зарласан сургалтын хувьд гэрчилгээг арга хэмжээ дууссанаас хойш ажлын 10 өдрийн дотор олгоно.
Гишүүнчлэлийн эрх төлбөр баталгаажсан өдрөөс нэг жилийн хугацаанд хүчинтэй байна.

Баталгаажуулах мэдэгдэл ирээгүй бол доор заасан хаягаар нийгэмлэгт хандана уу.',
        'The Society sells services rather than goods, so no postal or courier delivery applies.

Confirmation of registration is sent to the email address given at registration within one working day of payment being confirmed. It carries the registration reference, the name of the event, its dates and its venue.
Admission to an event is valid for the dates and venue announced. Participants are admitted to in-person events on their registration reference, and to online events through a link sent in advance.
Where a course is announced as carrying a certificate, the certificate is issued within ten working days of the course ending.
Membership runs for one year from the date payment is confirmed.

If no confirmation arrives, please contact the Society at the address below.'
      ) ON CONFLICT(key) DO NOTHING;

      INSERT INTO pages (key, title_mn, title_en, body_mn, body_en) VALUES (
        'terms.payment',
        'Төлбөрийн нөхцөл',
        'Payment',
        'Бүх гүйлгээ Монгол Улсын үндэсний мөнгөн тэмдэгт төгрөгөөр (MNT, ₮) хийгдэнэ. Цахим хуудсанд заасан үнэ нь эцсийн үнэ бөгөөд нэмэлт шимтгэл, хураамж тооцохгүй.

Төлбөрийг банкны шилжүүлэг болон банкны картаар хийнэ.
Бүртгэл нь төлбөр бүрэн хийгдсэний дараа баталгаажна. Төлбөр хийгдээгүй бүртгэлийг арга хэмжээ эхлэхээс өмнө цуцалж болно.
Эрт бүртгэлийн хөнгөлөлттэй үнэ зарласан бол уг үнэ нь зарлагдсан хугацаанд төлбөр бүрэн хийгдсэн тохиолдолд хүчинтэй.
Төлбөрийн баримтыг хүсэлтийн дагуу цахим шуудангаар илгээнэ.',
        'All transactions are in Mongolian tögrög (MNT, ₮). The price shown on the site is the final price; no further fees or charges are added.

Payment is made by bank transfer or by bank card.
A registration is confirmed once payment has been received in full. Unpaid registrations may be cancelled before the event begins.
Where an early registration price is announced, it applies only if payment is completed in full within the announced period.
A receipt is sent by email on request.'
      ) ON CONFLICT(key) DO NOTHING;

      INSERT INTO pages (key, title_mn, title_en, body_mn, body_en) VALUES (
        'terms.refund',
        'Төлбөр буцаах нөхцөл',
        'Refunds and cancellation',
        'Оролцогч бүртгэлээ цуцлах хүсэлтээ доор заасан цахим шуудангийн хаягаар, бүртгэлийн дугаараа заан илгээнэ.

Арга хэмжээ эхлэхээс 14 ба түүнээс дээш хоногийн өмнө хүсэлт гаргасан бол төлбөрийг бүрэн буцаана.
Арга хэмжээ эхлэхээс 7-13 хоногийн өмнө хүсэлт гаргасан бол төлбөрийн 50 хувийг буцаана.
Арга хэмжээ эхлэхээс 7 хоногоос доош хугацаанд хүсэлт гаргасан, эсхүл оролцоогүй тохиолдолд төлбөрийг буцаахгүй.
Нийгэмлэгийн шалтгаанаар арга хэмжээ цуцлагдсан буюу огноо өөрчлөгдсөн тохиолдолд оролцогчийн сонголтоор төлбөрийг бүрэн буцаах, эсхүл шинэ огноонд шилжүүлнэ.
Гишүүнчлэлийн жилийн татварыг буцаахгүй.

Буцаалтыг хүсэлт хүлээн авснаас хойш ажлын 14 өдрийн дотор төлбөр хийгдсэн данс, эсхүл картанд буцаана.',
        'To cancel a registration, write to the email address below quoting the registration reference.

Cancelled 14 or more days before the event begins: the fee is refunded in full.
Cancelled 7 to 13 days before the event begins: half the fee is refunded.
Cancelled fewer than 7 days before the event begins, or not attended: no refund is made.
If the Society cancels an event or changes its dates, the participant may choose between a full refund and a transfer to the new dates.
Annual membership subscriptions are not refundable.

Refunds are returned to the account or card the payment came from within fourteen working days of the request being received.'
      ) ON CONFLICT(key) DO NOTHING;

      INSERT INTO pages (key, title_mn, title_en, body_mn, body_en) VALUES (
        'terms.entity',
        'Байгууллагын мэдээлэл',
        'The organisation',
        '',
        ''
      ) ON CONFLICT(key) DO NOTHING;
    `,
  },
  {
    /*
      The fields a conference announcement needs and the record did not have.

      The September course is jointly held by four institutions, carries CME credit, is
      taught in two languages and accepts two kinds of abstract. All of that lived in a
      summary paragraph, so the page could only ever restate it as prose. A layout is not
      thin because of its columns; it is thin because the record behind it holds four
      facts, and these are the facts a reader of a congress announcement looks for.

      Free text rather than enumerations: the next course's format will not fit this
      one's list, and an editor should not need a migration to say so.
    */
    id: "2026-09-04-event-announcement-fields",
    sql: `
      ALTER TABLE events ADD COLUMN format_mn TEXT NOT NULL DEFAULT '';
      ALTER TABLE events ADD COLUMN format_en TEXT NOT NULL DEFAULT '';
      ALTER TABLE events ADD COLUMN accreditation_mn TEXT NOT NULL DEFAULT '';
      ALTER TABLE events ADD COLUMN accreditation_en TEXT NOT NULL DEFAULT '';
      ALTER TABLE events ADD COLUMN languages_mn TEXT NOT NULL DEFAULT '';
      ALTER TABLE events ADD COLUMN languages_en TEXT NOT NULL DEFAULT '';
      ALTER TABLE events ADD COLUMN abstract_categories_mn TEXT NOT NULL DEFAULT '';
      ALTER TABLE events ADD COLUMN abstract_categories_en TEXT NOT NULL DEFAULT '';
      ALTER TABLE events ADD COLUMN secretariat_email TEXT NOT NULL DEFAULT '';
      ALTER TABLE events ADD COLUMN guidelines_url TEXT NOT NULL DEFAULT '';

      CREATE TABLE IF NOT EXISTS event_organisers (
        id       TEXT PRIMARY KEY,
        event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        name_mn  TEXT NOT NULL DEFAULT '',
        name_en  TEXT NOT NULL DEFAULT '',
        role_mn  TEXT NOT NULL DEFAULT '',
        role_en  TEXT NOT NULL DEFAULT '',
        sort     INTEGER NOT NULL DEFAULT 0
      );
    `,
  },
  {
    /*
      One pair of em dashes in the English collaboration intro, replaced with the commas
      the Mongolian sentence already used. The dashes were a translation artefact: the
      Mongolian reads "гэдэсний эмгэг, ялангуяа үрэвсэлт гэдэсний өвчний (ҮГӨ) чиглэлээр"
      with commas, and the English should not be louder than the sentence it translates.

      Guarded on the old text so it leaves alone any wording the Society has since
      revised in the admin. Em dashes elsewhere on the site are punctuation doing a job —
      the empty-cell dash in a table of dates, chiefly — and stay.
    */
    id: "2026-09-04-collaboration-intro-commas",
    sql: `
      UPDATE pages
         SET body_en = 'The Society works with international professional organisations in intestinal disease, particularly inflammatory bowel disease (IBD), to give its members access to shared knowledge and experience.',
             updated_at = datetime('now')
       WHERE key = 'collaboration.intro'
         AND body_en = 'The Society works with international professional organisations in intestinal disease — particularly inflammatory bowel disease (IBD) — to give its members access to shared knowledge and experience.';
    `,
  },
  {
    /*
      The September course, from the First Central Hospital's letter No. 1/1555 of
      2 September 2026 and its annex: the approved course sheet, the faculty table and
      the programme. This is the content the announcement fields were added for.

      Two tracks run on the 19th in different buildings — the IBD lectures at the
      Mongolia–Japan hospital, the endoscope disinfection course at the First Central
      Hospital. The programme has no track column, so each track opens with an untimed
      heading row naming it and its venue, and the second track sorts after the first;
      moderators are untimed rows in the same way. Cheaper than a schema for one meeting.

      The organiser and programme inserts are guarded: they run only where the event
      has none yet, so rows an editor has already entered are never replaced. The
      course-sheet facts (format, credit hours, categories, address) are set outright —
      the columns are a day old and empty — while venue and capacity fill in only where
      empty, since those two predate today.
    */
    id: "2026-09-04-ibd-endoscopy-2026-programme",
    sql: `
      UPDATE events SET
        format_mn = 'Танхимын сургалт: 13 лекц, гардан сургалт, тохиолдлын хэлэлцүүлэг',
        format_en = 'In person: 13 lectures, hands-on sessions and case discussions',
        accreditation_mn = 'Улсын хэмжээний сургалт, 2 багц цаг',
        accreditation_en = 'National training course, 2 CME credit hours',
        languages_mn = 'Монгол',
        languages_en = 'Mongolian',
        abstract_categories_mn = 'Судалгааны илтгэл: гэдэсний эмгэг судлалын чиглэлээр хийсэн судалгааны ажлын үр дүн
Тохиолдлын танилцуулга: сонин бөгөөд төвөгтэй эмнэлзүйн тохиолдол',
        abstract_categories_en = 'Research presentations: results of original research in intestinal disease
Case presentations: unusual and challenging clinical cases',
        secretariat_email = 'ibdmsid@gmail.com',
        venue_mn = CASE WHEN venue_mn = '' THEN 'Улсын Нэгдүгээр Төв Эмнэлэг ба АШУҮИС-ийн Монгол-Япон сургалтын эмнэлэг' ELSE venue_mn END,
        venue_en = CASE WHEN venue_en = '' THEN 'First Central Hospital and MNUMS Mongolia–Japan Teaching Hospital' ELSE venue_en END,
        capacity = COALESCE(capacity, 200),
        updated_at = datetime('now')
      WHERE slug = 'ibd-endoscopy-2026';

      WITH v(name_mn, name_en, role_mn, role_en, sort) AS (VALUES
        ('Улсын Нэгдүгээр Төв Эмнэлэг, Гастроэнтерологийн төв', 'First Central Hospital of Mongolia, Gastroenterology Centre', 'Сургалт зохион байгуулагч', 'Course organiser', 0),
        ('Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэг', 'Mongolian Society of Intestinal Disease', 'Сургалт зохион байгуулагч', 'Course organiser', 1),
        ('Монголын Гастроэнтерологийн Холбоо', 'Mongolian Gastroenterology Association', 'Хамтран оролцогч', 'Participating society', 2),
        ('АШУҮИС-ийн Хоол Боловсруулах Эрхтэн Судлалын Төв', 'MNUMS Centre for the Study of Digestive Organs', 'Хамтран оролцогч', 'Participating centre', 3)
      )
      INSERT INTO event_organisers (id, event_id, name_mn, name_en, role_mn, role_en, sort)
      SELECT lower(hex(randomblob(16))), e.id, v.name_mn, v.name_en, v.role_mn, v.role_en, v.sort
        FROM v, events e
       WHERE e.slug = 'ibd-endoscopy-2026'
         AND NOT EXISTS (SELECT 1 FROM event_organisers o WHERE o.event_id = e.id);

      WITH v(day, starts_at, ends_at, title_mn, title_en, speaker_mn, speaker_en, room_mn, room_en, sort) AS (VALUES
        ('2026-09-18', '', '', 'Гэдэсний хэт авиан шинжилгээний гардан сургалт', 'Intestinal ultrasound hands-on course', '', '', 'УНТЭ, Гастроэнтерологийн төвийн сургалтын өрөө · дүрс оношилгооны 20 эмч', 'FCHM Gastroenterology Centre training room · 20 imaging physicians', 1),
        ('2026-09-18', '09:00', '09:50', 'Бүртгэл', 'Registration', 'Б.Уянга, УНТЭ', 'B. Uyanga, FCHM', '', '', 2),
        ('2026-09-18', '09:50', '10:00', 'Нээлт', 'Opening', 'О.Баярмаа, УНТЭ', 'O. Bayarmaa, FCHM', '', '', 3),
        ('2026-09-18', '10:00', '13:00', 'Гэдэсний хэт авиан шинжилгээ: онол, гардан хосолсон сургалт, 1-р бүлэг', 'Intestinal ultrasound: theory and hands-on session, group 1', 'Б.Эрдэнэцэцэг, MD MSc, УНТЭ', 'B. Erdenetsetseg, MD MSc, FCHM', '', '', 4),
        ('2026-09-18', '13:00', '13:20', 'Завсарлага', 'Break', '', '', '', '', 5),
        ('2026-09-18', '13:20', '16:20', 'Гэдэсний хэт авиан шинжилгээ: онол, гардан хосолсон сургалт, 2-р бүлэг', 'Intestinal ultrasound: theory and hands-on session, group 2', 'Б.Эрдэнэцэцэг, MD MSc, УНТЭ', 'B. Erdenetsetseg, MD MSc, FCHM', '', '', 6),
        ('2026-09-19', '', '', 'Гэдэсний үрэвсэлт эмгэгийн оношилгоо, эмчилгээний менежмент', 'Inflammatory bowel disease: diagnosis and treatment management', '', '', 'АШУҮИС-ийн Монгол-Япон сургалтын эмнэлгийн «Blue Hall» танхим', 'MNUMS Mongolia–Japan Teaching Hospital, Blue Hall', 1),
        ('2026-09-19', '09:00', '09:50', 'Бүртгэл', 'Registration', 'Б.Уянга, УНТЭ', 'B. Uyanga, FCHM', '', '', 2),
        ('2026-09-19', '09:50', '10:00', 'Нээлт', 'Opening', 'О.Баярмаа, УНТЭ', 'O. Bayarmaa, FCHM', '', '', 3),
        ('2026-09-19', '', '', 'Модератор', 'Moderators', 'Ц.Бямбажав, MD PhD, АШУҮИС; Д.Өлзий, MD PhD, АШУҮИС', 'Ts. Byambajav, MD PhD, MNUMS; D. Ulzii, MD PhD, MNUMS', '', '', 4),
        ('2026-09-19', '10:00', '10:20', 'Гэдэсний үрэвсэлт эмгэгийн эмчилгээ ба хяналт', 'Treatment and monitoring of inflammatory bowel disease', 'Д.Ариунзул, MD MSc, УНТЭ', 'D. Ariunzul, MD MSc, FCHM', '', '', 5),
        ('2026-09-19', '10:20', '10:40', 'Гэдэсний үрэвсэлт эмгэгийн бай эмчилгээ (инфликсимаб)', 'Targeted therapy in inflammatory bowel disease (infliximab)', 'О.Баярмаа, MD PhD, УНТЭ', 'O. Bayarmaa, MD PhD, FCHM', '', '', 6),
        ('2026-09-19', '10:40', '10:50', 'Асуулт, хариулт', 'Questions and answers', '', '', '', '', 7),
        ('2026-09-19', '10:50', '11:00', 'Эмийн танилцуулга', 'Sponsor presentation', '', '', '', '', 8),
        ('2026-09-19', '11:00', '11:20', 'Цайны завсарлага', 'Coffee break', '', '', '', '', 9),
        ('2026-09-19', '11:20', '11:40', 'Гэдэсний үрэвсэлт эмгэгийн үеийн хоол, шим тэжээлийн менежмент', 'Nutritional management in inflammatory bowel disease', 'Б.Нурмаа, MD MSc, Интермед эмнэлэг', 'B. Nurmaa, MD MSc, Intermed Hospital', '', '', 10),
        ('2026-09-19', '11:40', '12:10', 'Бүдүүн гэдэсний шархлаат үрэвслийн эмнэлзүйн зааврын танилцуулга', 'Introducing the clinical guideline on ulcerative colitis', 'Н.Бира, MD PhD, профессор, АШУҮИС', 'N. Bira, MD PhD, Professor, MNUMS', '', '', 11),
        ('2026-09-19', '12:10', '12:30', 'Асуулт, хариулт', 'Questions and answers', '', '', '', '', 12),
        ('2026-09-19', '12:30', '12:40', 'Эмийн танилцуулга', 'Sponsor presentation', '', '', '', '', 13),
        ('2026-09-19', '12:40', '13:20', 'Үдийн хоол', 'Lunch', '', '', '', '', 14),
        ('2026-09-19', '', '', 'Модератор', 'Moderators', 'О.Баярмаа, MD PhD, УНТЭ; Н.Бира, MD PhD, профессор, АШУҮИС', 'O. Bayarmaa, MD PhD, FCHM; N. Bira, MD PhD, Professor, MNUMS', '', '', 15),
        ('2026-09-19', '13:20', '13:40', 'Нарийн гэдэсний эмгэгийн дурангийн оношилгоо, эмчилгээний менежмент', 'Endoscopic diagnosis and management of small-bowel disease', 'Х.Цэвэлноров, MD PhD, АШУҮИС', 'Kh. Tsevelnorov, MD PhD, MNUMS', '', '', 16),
        ('2026-09-19', '13:40', '14:00', 'Архаг суулгалтын ялган оношилгоо, эмчилгээний менежмент', 'Differential diagnosis and management of chronic diarrhoea', 'Г.Сарантуяа, MD PhD, АШУҮИС', 'G. Sarantuya, MD PhD, MNUMS', '', '', 17),
        ('2026-09-19', '14:00', '14:20', 'Гэдэсний эмгэгтэй хүүхдийг насанд хүрэгчдийн тусламжид шилжүүлэх нь (transition care)', 'Transition of care for children with intestinal disease', 'Д.Өлзий, MD PhD, АШУҮИС', 'D. Ulzii, MD PhD, MNUMS', '', '', 18),
        ('2026-09-19', '14:20', '14:40', 'Бүдүүн гэдэсний хавдрын эрт илрүүлгийн хөтөлбөр', 'Colorectal cancer screening programme', 'Ц.Бямбажав, MD PhD, АШУҮИС', 'Ts. Byambajav, MD PhD, MNUMS', '', '', 19),
        ('2026-09-19', '14:40', '14:50', 'Асуулт, хариулт', 'Questions and answers', '', '', '', '', 20),
        ('2026-09-19', '14:50', '15:00', 'Эмийн танилцуулга', 'Sponsor presentation', '', '', '', '', 21),
        ('2026-09-19', '15:00', '15:20', 'Цайны завсарлага', 'Coffee break', '', '', '', '', 22),
        ('2026-09-19', '15:20', '16:20', 'Илтгэл ба тохиолдлын танилцуулга', 'Abstract and case presentations', '', '', '', '', 23),
        ('2026-09-19', '16:20', '16:40', 'Хэлэлцүүлэг', 'Discussion', '', '', '', '', 24),
        ('2026-09-19', '16:40', '17:00', 'Шалгаруулалт, шагнал гардуулах, хаалт', 'Awards and closing', 'Д.Ариунзул, MD MSc, УНТЭ', 'D. Ariunzul, MD MSc, FCHM', '', '', 25),
        ('2026-09-19', '', '', 'Дурангийн аюулгүй ажиллагаа, халдваргүйтгэл (зэрэгцээ хуралдаан)', 'Endoscope safety and disinfection (parallel session)', '', '', 'УНТЭ, хурлын их танхим ба дурангийн оношилгоо, эмчилгээний хэсэг', 'FCHM conference hall and endoscopy unit', 101),
        ('2026-09-19', '09:00', '09:50', 'Бүртгэл', 'Registration', 'Д.Долгорсүрэн, дурангийн зохицуулагч сувилагч, УНТЭ', 'D. Dolgorsuren, endoscopy nurse coordinator, FCHM', '', '', 102),
        ('2026-09-19', '09:50', '10:00', 'Нээлт', 'Opening', 'М.Шийлэгдулам, Сувилахуйн албаны дарга, УНТЭ; А.Алтангагнуур, дурангийн ахлах эмч, УНТЭ', 'M. Shiilegdulam, Head of Nursing, FCHM; A. Altangagnuur, Senior Endoscopist, FCHM', '', '', 103),
        ('2026-09-19', '10:00', '10:20', 'Дурангийн түгээмэл тохиолдох гэмтлүүд, тэдгээрээс урьдчилан сэргийлэх арга замууд', 'Common endoscope damage and how to prevent it', 'С.Бямба-Эрдэнэ, ахлах инженер, Медимпекс Инт ХХК', 'S. Byamba-Erdene, Senior Engineer, Medimpex International', '', '', 104),
        ('2026-09-19', '10:20', '10:40', 'Дурангийн цэвэрлэгээ, халдваргүйтгэл ба хяналт', 'Endoscope cleaning, disinfection and monitoring', 'Х.Намуун, Халдвар судлал, хяналтын албаны дарга, УНТЭ', 'Kh. Namuun, Head of Infection Control, FCHM', '', '', 105),
        ('2026-09-19', '10:40', '11:00', 'Дурангийн өндөр түвшний халдваргүйтгэл, сувилагчийн оролцоо', 'High-level disinfection of endoscopes and the role of the nurse', 'М.Шийлэгдулам, MSc, УНТЭ', 'M. Shiilegdulam, MSc, FCHM', '', '', 106),
        ('2026-09-19', '11:00', '11:10', 'Асуулт, хариулт', 'Questions and answers', '', '', '', '', 107),
        ('2026-09-19', '11:10', '11:30', 'Цайны завсарлага', 'Coffee break', '', '', '', '', 108),
        ('2026-09-19', '11:30', '14:00', 'Гардан сургалт', 'Hands-on session', 'М.Шийлэгдулам; Д.Долгорсүрэн, УНТЭ', 'M. Shiilegdulam; D. Dolgorsuren, FCHM', '', '', 109)
      )
      INSERT INTO event_sessions (id, event_id, day, starts_at, ends_at, title_mn, title_en, speaker_mn, speaker_en, room_mn, room_en, sort)
      SELECT lower(hex(randomblob(16))), e.id, v.day, v.starts_at, v.ends_at, v.title_mn, v.title_en, v.speaker_mn, v.speaker_en, v.room_mn, v.room_en, v.sort
        FROM v, events e
       WHERE e.slug = 'ibd-endoscopy-2026'
         AND NOT EXISTS (SELECT 1 FROM event_sessions s WHERE s.event_id = e.id);
    `,
  },
];

async function applyMigrations(client: Client): Promise<void> {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS _migrations (
       id TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     )`,
  );

  const applied = new Set(
    (await client.execute("SELECT id FROM _migrations")).rows.map((row) =>
      String(row.id),
    ),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    try {
      await client.executeMultiple(migration.sql);
      await client.execute({
        sql: "INSERT INTO _migrations (id) VALUES (?)",
        args: [migration.id],
      });
      console.log(`Applied migration ${migration.id}`);
    } catch (error) {
      /*
        A column that already exists means a previous run applied the change but did not
        record it — recoverable, so record it and move on. Anything else is a real
        failure and must not be hidden.
      */
      if (/duplicate column name/i.test((error as Error).message ?? "")) {
        await client.execute({
          sql: "INSERT OR IGNORE INTO _migrations (id) VALUES (?)",
          args: [migration.id],
        });
        continue;
      }
      throw error;
    }
  }
}

async function connect(): Promise<Client> {
  const config = connectionConfig();
  const isLocalFile = config.url.startsWith("file:");

  if (isLocalFile) {
    // The directory has to exist before SQLite will create the file in it.
    const { mkdirSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    const filePath = config.url.slice("file:".length);
    mkdirSync(dirname(filePath), { recursive: true });
  }

  const client = createClient(config);

  if (isLocalFile) await client.executeMultiple(LOCAL_PRAGMAS);

  // `CREATE TABLE IF NOT EXISTS` throughout, so this is safe on every cold start and
  // means a freshly created Turso database comes up working.
  await client.executeMultiple(SCHEMA);
  await applyMigrations(client);

  /*
    Seed on first connection.

    A serverless host has no entrypoint to run `npm run seed` from, and Vercel's
    `env pull` replaces encrypted values with the literal string `[SENSITIVE]`, so the
    credentials to seed remotely cannot be obtained either. Without this, a Vercel
    deployment comes up with empty tables: no administrator to sign in as, no partner
    societies, no page content.

    `seedDatabase` is idempotent and returns early once content exists, so the steady
    -state cost is one `COUNT(*)` per cold start. A failure here must not take the site
    down — an empty site that renders is better than one that 500s — so it is logged
    and swallowed.
  */
  try {
    const { seedDatabase } = await import("./seed-data.ts");
    const result = await runTransaction(client, (tx) => seedDatabase(tx));
    if (result.seededContent) console.log("Database seeded with first-run content.");
    if (result.createdAdmin) console.log(`Administrator created: ${result.createdAdmin}`);
  } catch (error) {
    console.error("Seeding on first connection failed", error);
  }

  return client;
}

export function db(): Promise<Client> {
  const globalRef = globalThis as GlobalWithDb;
  if (!globalRef.__msidDb) globalRef.__msidDb = connect();
  return globalRef.__msidDb;
}

/* -------------------------------------------------------------------------- */
/* Query helpers                                                               */
/* -------------------------------------------------------------------------- */

/** libSQL rows are array-like; copy to plain objects so React and JSON behave. */
function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export async function all<T>(sql: string, ...params: Param[]): Promise<T[]> {
  const result = await (await db()).execute({ sql, args: params });
  return result.rows.map((row) => plain<T>(row));
}

export async function get<T>(sql: string, ...params: Param[]): Promise<T | undefined> {
  const result = await (await db()).execute({ sql, args: params });
  return result.rows.length ? plain<T>(result.rows[0]) : undefined;
}

export async function run(sql: string, ...params: Param[]) {
  const result = await (await db()).execute({ sql, args: params });
  return { changes: Number(result.rowsAffected ?? 0) };
}

export async function count(sql: string, ...params: Param[]): Promise<number> {
  const row = await get<{ n: number | bigint }>(sql, ...params);
  return Number(row?.n ?? 0);
}

/* -------------------------------------------------------------------------- */
/* Transactions                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The statement runner handed to a `transaction()` callback.
 *
 * Callbacks must use this rather than the module-level helpers — those take a fresh
 * connection and would run *outside* the transaction, which is the kind of bug that
 * only shows up when a rollback silently fails to undo half the work.
 */
export interface Tx {
  all<T>(sql: string, ...params: Param[]): Promise<T[]>;
  get<T>(sql: string, ...params: Param[]): Promise<T | undefined>;
  run(sql: string, ...params: Param[]): Promise<{ changes: number }>;
}

/** Runs `fn` inside a transaction, rolling back if it throws. */
export async function transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return runTransaction(await db(), fn);
}

/**
 * The same, against a client passed in explicitly.
 *
 * Seeding runs *inside* `connect()`, before the cached connection promise has settled.
 * Going through `db()` there would re-enter `connect()` and wait on a promise that
 * cannot resolve until the seeding it is waiting for completes.
 */
export async function runTransaction<T>(
  client: Client,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const tx = await client.transaction("write");

  const runner: Tx = {
    async all<R>(sql: string, ...params: Param[]) {
      const result = await tx.execute({ sql, args: params });
      return result.rows.map((row) => plain<R>(row));
    },
    async get<R>(sql: string, ...params: Param[]) {
      const result = await tx.execute({ sql, args: params });
      return result.rows.length ? plain<R>(result.rows[0]) : undefined;
    },
    async run(sql: string, ...params: Param[]) {
      const result = await tx.execute({ sql, args: params });
      return { changes: Number(result.rowsAffected ?? 0) };
    },
  };

  try {
    const value = await fn(runner);
    await tx.commit();
    return value;
  } catch (error) {
    await tx.rollback().catch(() => {
      // Rollback failure must not mask the original error.
    });
    throw error;
  }
}

export const newId = (): string => randomUUID();

export const now = (): string => new Date().toISOString().slice(0, 19).replace("T", " ");

/**
 * Builds a parameterised `UPDATE ... SET` clause from a partial record, skipping
 * `undefined` values so callers can pass sparse patches safely.
 */
export function setClause(patch: Record<string, Param | undefined>): {
  sql: string;
  params: Param[];
} {
  const keys = Object.keys(patch).filter((key) => patch[key] !== undefined);
  return {
    sql: keys.map((key) => `${key} = ?`).join(", "),
    params: keys.map((key) => patch[key] as Param),
  };
}

/** URL-safe slug that keeps Mongolian Cyrillic readable by transliterating it. */
const CYRILLIC_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i",
  й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", ө: "u", п: "p", р: "r", с: "s",
  т: "t", у: "u", ү: "u", ф: "f", х: "kh", ц: "ts", ч: "ch", ш: "sh", щ: "sh",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((char) => CYRILLIC_MAP[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Appends `-2`, `-3`, … until the slug is free in `table`.
 *
 * Takes a `Tx` because it is only ever called while building a record inside a
 * transaction, and the uniqueness check has to see that transaction's own writes.
 */
export async function uniqueSlug(
  tx: Tx,
  table: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  const root = slugify(base) || "item";
  let candidate = root;
  let n = 1;
  // Table name is caller-controlled and never user input.
  while (
    await tx.get<{ id: string }>(
      `SELECT id FROM ${table} WHERE slug = ? AND id IS NOT ?`,
      candidate,
      excludeId ?? null,
    )
  ) {
    n += 1;
    candidate = `${root}-${n}`;
  }
  return candidate;
}
