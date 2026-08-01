/**
 * Database schema.
 *
 * Kept as a TypeScript module rather than a .sql file read at runtime: reading it with
 * `fs` and `process.cwd()` made Next's dependency tracer pull the entire project into
 * the build output, and meant a standalone deployment could start without its schema
 * present. Inlined, the schema always ships with the code.
 *
 * It is applied on first connection and is written with `CREATE TABLE IF NOT EXISTS`,
 * so re-running it is safe. It will not alter a table that already exists, so a change
 * to a live database must be appended to MIGRATIONS in ./index.ts instead.
 *
 * DDL only — no PRAGMA statements. `journal_mode` and friends describe how a local
 * SQLite file is written, which a hosted libSQL server rejects outright; leaving them
 * here made every connection to Turso throw. `LOCAL_PRAGMAS` in ./index.ts applies them
 * to file-backed connections only.
 */
export const SCHEMA = `-- MSID website schema
-- Every content table carries a paired _mn / _en column set. Mongolian is the primary
-- language; English is a full peer. A row with an empty _en is legal and renders as a
-- "not yet translated" state rather than as broken output.

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id             TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL DEFAULT 'member'
                   CHECK (role IN ('admin', 'editor', 'member')),
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'active', 'suspended')),
  name_mn        TEXT NOT NULL DEFAULT '',
  name_en        TEXT NOT NULL DEFAULT '',
  last_login_at  TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS member_profiles (
  user_id           TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  member_no         TEXT UNIQUE,
  degree            TEXT NOT NULL DEFAULT '',
  specialty_mn      TEXT NOT NULL DEFAULT '',
  specialty_en      TEXT NOT NULL DEFAULT '',
  institution_mn    TEXT NOT NULL DEFAULT '',
  institution_en    TEXT NOT NULL DEFAULT '',
  position_mn       TEXT NOT NULL DEFAULT '',
  position_en       TEXT NOT NULL DEFAULT '',
  phone             TEXT NOT NULL DEFAULT '',
  membership_type   TEXT NOT NULL DEFAULT 'full'
                      CHECK (membership_type IN ('full', 'associate', 'trainee', 'honorary')),
  membership_status TEXT NOT NULL DEFAULT 'pending'
                      CHECK (membership_status IN ('pending', 'active', 'expired', 'rejected')),
  joined_on         TEXT,
  valid_until       TEXT,
  notes             TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_member_status ON member_profiles(membership_status);

-- Server-side session records so a session can be revoked without waiting for the
-- signed cookie to expire.
CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- One row per failed sign-in, used to throttle guessing. The identity column holds
-- either "email:someone@example.com" or "ip:1.2.3.4", so a single table limits both
-- the account being attacked and the machine doing the attacking.
CREATE TABLE IF NOT EXISTS login_attempts (
  id           TEXT PRIMARY KEY,
  identity     TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_login_attempts ON login_attempts(identity, attempted_at);

-- ---------------------------------------------------------------------------
-- Events and programmes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS events (
  id                    TEXT PRIMARY KEY,
  slug                  TEXT NOT NULL UNIQUE,
  kind                  TEXT NOT NULL DEFAULT 'congress'
                          CHECK (kind IN ('congress', 'training', 'conference', 'webinar', 'case_conference')),
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft', 'published', 'archived')),
  title_mn              TEXT NOT NULL DEFAULT '',
  title_en              TEXT NOT NULL DEFAULT '',
  summary_mn            TEXT NOT NULL DEFAULT '',
  summary_en            TEXT NOT NULL DEFAULT '',
  body_mn               TEXT NOT NULL DEFAULT '',
  body_en               TEXT NOT NULL DEFAULT '',
  venue_mn              TEXT NOT NULL DEFAULT '',
  venue_en              TEXT NOT NULL DEFAULT '',
  city_mn               TEXT NOT NULL DEFAULT '',
  city_en               TEXT NOT NULL DEFAULT '',
  starts_on             TEXT,
  ends_on               TEXT,
  cover_image           TEXT NOT NULL DEFAULT '',
  cover_alt_mn          TEXT NOT NULL DEFAULT '',
  cover_alt_en          TEXT NOT NULL DEFAULT '',
  registration_open     INTEGER NOT NULL DEFAULT 0,
  registration_opens_on TEXT,
  registration_closes_on TEXT,
  abstract_deadline     TEXT,
  early_bird_deadline   TEXT,
  capacity              INTEGER,
  external_url          TEXT NOT NULL DEFAULT '',
  video_url             TEXT NOT NULL DEFAULT '',
  is_featured           INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, starts_on);

CREATE TABLE IF NOT EXISTS event_fees (
  id               TEXT PRIMARY KEY,
  event_id         TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  label_mn         TEXT NOT NULL DEFAULT '',
  label_en         TEXT NOT NULL DEFAULT '',
  audience         TEXT NOT NULL DEFAULT 'non_member'
                     CHECK (audience IN ('member', 'non_member', 'trainee', 'international', 'student')),
  amount_mnt       INTEGER NOT NULL DEFAULT 0,
  early_amount_mnt INTEGER,
  sort             INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_fees_event ON event_fees(event_id, sort);

CREATE TABLE IF NOT EXISTS event_sessions (
  id         TEXT PRIMARY KEY,
  event_id   TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  day        TEXT,
  starts_at  TEXT NOT NULL DEFAULT '',
  ends_at    TEXT NOT NULL DEFAULT '',
  title_mn   TEXT NOT NULL DEFAULT '',
  title_en   TEXT NOT NULL DEFAULT '',
  speaker_mn TEXT NOT NULL DEFAULT '',
  speaker_en TEXT NOT NULL DEFAULT '',
  room_mn    TEXT NOT NULL DEFAULT '',
  room_en    TEXT NOT NULL DEFAULT '',
  sort       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sessions_event ON event_sessions(event_id, day, sort);

CREATE TABLE IF NOT EXISTS registrations (
  id                TEXT PRIMARY KEY,
  reference         TEXT NOT NULL UNIQUE,
  event_id          TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id           TEXT REFERENCES users(id) ON DELETE SET NULL,
  fee_id            TEXT REFERENCES event_fees(id) ON DELETE SET NULL,
  full_name         TEXT NOT NULL DEFAULT '',
  email             TEXT NOT NULL DEFAULT '',
  phone             TEXT NOT NULL DEFAULT '',
  institution       TEXT NOT NULL DEFAULT '',
  position          TEXT NOT NULL DEFAULT '',
  country           TEXT NOT NULL DEFAULT 'MN',
  is_member         INTEGER NOT NULL DEFAULT 0,
  amount_mnt        INTEGER NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'MNT',
  payment_method    TEXT NOT NULL DEFAULT 'bank_transfer'
                      CHECK (payment_method IN ('bank_transfer', 'qpay', 'free')),
  payment_status    TEXT NOT NULL DEFAULT 'unpaid'
                      CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'refunded', 'cancelled')),
  payment_ref       TEXT NOT NULL DEFAULT '',
  paid_at           TEXT,
  attendance_status TEXT NOT NULL DEFAULT 'registered'
                      CHECK (attendance_status IN ('registered', 'confirmed', 'attended', 'cancelled', 'no_show')),
  abstract_title    TEXT NOT NULL DEFAULT '',
  notes             TEXT NOT NULL DEFAULT '',
  locale            TEXT NOT NULL DEFAULT 'mn',
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reg_event ON registrations(event_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_reg_user ON registrations(user_id);

-- Payment attempts ledger. One registration can have several attempts (a failed QPay
-- invoice followed by a bank transfer, for example); the registration row holds the
-- current truth and this table holds the history.
CREATE TABLE IF NOT EXISTS payments (
  id                  TEXT PRIMARY KEY,
  registration_id     TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  provider            TEXT NOT NULL DEFAULT 'bank_transfer',
  provider_invoice_id TEXT NOT NULL DEFAULT '',
  amount_mnt          INTEGER NOT NULL DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'created'
                        CHECK (status IN ('created', 'pending', 'paid', 'failed', 'cancelled', 'refunded')),
  raw_payload         TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_reg ON payments(registration_id);

-- ---------------------------------------------------------------------------
-- Publications, guidelines, news
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS publications (
  id            TEXT PRIMARY KEY,
  slug          TEXT NOT NULL UNIQUE,
  kind          TEXT NOT NULL DEFAULT 'article'
                  CHECK (kind IN ('article', 'issue', 'abstract', 'report')),
  status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'published', 'archived')),
  title_mn      TEXT NOT NULL DEFAULT '',
  title_en      TEXT NOT NULL DEFAULT '',
  authors_mn    TEXT NOT NULL DEFAULT '',
  authors_en    TEXT NOT NULL DEFAULT '',
  abstract_mn   TEXT NOT NULL DEFAULT '',
  abstract_en   TEXT NOT NULL DEFAULT '',
  journal_mn    TEXT NOT NULL DEFAULT '',
  journal_en    TEXT NOT NULL DEFAULT '',
  volume        TEXT NOT NULL DEFAULT '',
  issue         TEXT NOT NULL DEFAULT '',
  pages         TEXT NOT NULL DEFAULT '',
  published_on  TEXT,
  doi           TEXT NOT NULL DEFAULT '',
  external_url  TEXT NOT NULL DEFAULT '',
  file_path     TEXT NOT NULL DEFAULT '',
  cover_image   TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pub_status ON publications(status, published_on);

CREATE TABLE IF NOT EXISTS guidelines (
  id             TEXT PRIMARY KEY,
  slug           TEXT NOT NULL UNIQUE,
  code           TEXT NOT NULL DEFAULT '',
  version        TEXT NOT NULL DEFAULT '1.0',
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft', 'review', 'published', 'superseded')),
  title_mn       TEXT NOT NULL DEFAULT '',
  title_en       TEXT NOT NULL DEFAULT '',
  summary_mn     TEXT NOT NULL DEFAULT '',
  summary_en     TEXT NOT NULL DEFAULT '',
  body_mn        TEXT NOT NULL DEFAULT '',
  body_en        TEXT NOT NULL DEFAULT '',
  category_mn    TEXT NOT NULL DEFAULT '',
  category_en    TEXT NOT NULL DEFAULT '',
  approved_on    TEXT,
  effective_from TEXT,
  review_due     TEXT,
  file_path      TEXT NOT NULL DEFAULT '',
  file_size      INTEGER NOT NULL DEFAULT 0,
  supersedes_id  TEXT REFERENCES guidelines(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_guidelines_status ON guidelines(status, effective_from);

CREATE TABLE IF NOT EXISTS news_posts (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'published', 'archived')),
  title_mn     TEXT NOT NULL DEFAULT '',
  title_en     TEXT NOT NULL DEFAULT '',
  excerpt_mn   TEXT NOT NULL DEFAULT '',
  excerpt_en   TEXT NOT NULL DEFAULT '',
  body_mn      TEXT NOT NULL DEFAULT '',
  body_en      TEXT NOT NULL DEFAULT '',
  cover_image  TEXT NOT NULL DEFAULT '',
  cover_alt_mn TEXT NOT NULL DEFAULT '',
  cover_alt_en TEXT NOT NULL DEFAULT '',
  video_url    TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_news_status ON news_posts(status, published_at);

-- ---------------------------------------------------------------------------
-- Editable site content
-- ---------------------------------------------------------------------------

-- Fixed-key prose blocks, so About sub-pages and intros are admin-editable without
-- inventing a page builder. Keys are seeded; the admin edits, never creates.
CREATE TABLE IF NOT EXISTS pages (
  key        TEXT PRIMARY KEY,
  title_mn   TEXT NOT NULL DEFAULT '',
  title_en   TEXT NOT NULL DEFAULT '',
  body_mn    TEXT NOT NULL DEFAULT '',
  body_en    TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS history_entries (
  id       TEXT PRIMARY KEY,
  year     INTEGER NOT NULL,
  happened_on TEXT,
  title_mn TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  body_mn  TEXT NOT NULL DEFAULT '',
  body_en  TEXT NOT NULL DEFAULT '',
  sort     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS board_members (
  id             TEXT PRIMARY KEY,
  name_mn        TEXT NOT NULL DEFAULT '',
  name_en        TEXT NOT NULL DEFAULT '',
  role_mn        TEXT NOT NULL DEFAULT '',
  role_en        TEXT NOT NULL DEFAULT '',
  degree         TEXT NOT NULL DEFAULT '',
  institution_mn TEXT NOT NULL DEFAULT '',
  institution_en TEXT NOT NULL DEFAULT '',
  photo          TEXT NOT NULL DEFAULT '',
  bio_mn         TEXT NOT NULL DEFAULT '',
  bio_en         TEXT NOT NULL DEFAULT '',
  term_from      TEXT,
  term_to        TEXT,
  is_current     INTEGER NOT NULL DEFAULT 1,
  sort           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS partners (
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
                   CHECK (kind IN ('society', 'academic', 'sponsor', 'government')),
  sort           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS uploads (
  id            TEXT PRIMARY KEY,
  path          TEXT NOT NULL,
  original_name TEXT NOT NULL DEFAULT '',
  mime          TEXT NOT NULL DEFAULT '',
  size          INTEGER NOT NULL DEFAULT 0,
  uploaded_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL DEFAULT '',
  entity     TEXT NOT NULL DEFAULT '',
  entity_id  TEXT NOT NULL DEFAULT '',
  meta       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
`;
