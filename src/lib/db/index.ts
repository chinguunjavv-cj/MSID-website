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
