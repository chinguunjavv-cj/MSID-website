import { cache } from "react";
import { all, get, count } from "@/lib/db";
import type {
  BoardMember,
  EventFee,
  EventPhoto,
  EventRow,
  EventSession,
  Guideline,
  HistoryEntry,
  MemberRecord,
  NewsPost,
  Page,
  Partner,
  Publication,
  Registration,
} from "@/lib/db/types";
import { todayIso } from "@/lib/format";

/* -------------------------------------------------------------------------- */
/* Pages                                                                       */
/* -------------------------------------------------------------------------- */

/** Fixed page keys. Seeded once; the admin edits them but never creates new ones. */
export const PAGE_KEYS = [
  "about.welcome",
  "about.history",
  "about.mission",
  "about.board",
  "about.contact",
  "collaboration.intro",
  "guidelines.intro",
  "publications.intro",
  "membership.intro",
  "membership.benefits",
  "home.about",
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export async function getPage(key: PageKey): Promise<Page | undefined> {
  return get<Page>("SELECT * FROM pages WHERE key = ?", key);
}

export async function listPages(): Promise<Page[]> {
  return all<Page>("SELECT * FROM pages ORDER BY key");
}

/* -------------------------------------------------------------------------- */
/* Events                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Events that have not finished yet, soonest first. An event with no end date counts
 * as upcoming until its start date passes.
 */
export async function listUpcomingEvents(limit = 20): Promise<EventRow[]> {
  return all<EventRow>(
    `SELECT * FROM events
     WHERE status = 'published'
       AND COALESCE(ends_on, starts_on, '9999-12-31') >= ?
     ORDER BY starts_on IS NULL, starts_on ASC
     LIMIT ?`,
    todayIso(),
    limit,
  );
}

export async function listPastEvents(limit = 50, offset = 0): Promise<EventRow[]> {
  return all<EventRow>(
    `SELECT * FROM events
     WHERE status = 'published'
       AND COALESCE(ends_on, starts_on) < ?
     ORDER BY starts_on DESC
     LIMIT ? OFFSET ?`,
    todayIso(),
    limit,
    offset,
  );
}

export async function countPastEvents(): Promise<number> {
  return count(
    `SELECT COUNT(*) AS n FROM events
     WHERE status = 'published' AND COALESCE(ends_on, starts_on) < ?`,
    todayIso(),
  );
}

/**
 * The four slug lookups below are wrapped in React's `cache()`.
 *
 * Every detail page reads its record twice — once in `generateMetadata` for the title
 * and description, once in the page itself — and Next deduplicates `fetch()` calls but
 * not arbitrary async functions. Without this, opening one guideline is two identical
 * round trips to a database on the other side of a network.
 */
export const getEventBySlug = cache(async function getEventBySlug(
  slug: string,
  includeDrafts = false,
): Promise<EventRow | undefined> {
  return get<EventRow>(
    `SELECT * FROM events WHERE slug = ?${includeDrafts ? "" : " AND status = 'published'"}`,
    slug,
  );
});

export async function getEventById(id: string): Promise<EventRow | undefined> {
  return get<EventRow>("SELECT * FROM events WHERE id = ?", id);
}

export async function listAllEvents(): Promise<EventRow[]> {
  return all<EventRow>(
    "SELECT * FROM events ORDER BY starts_on IS NULL, starts_on DESC, created_at DESC",
  );
}

export async function listEventFees(eventId: string): Promise<EventFee[]> {
  return all<EventFee>(
    "SELECT * FROM event_fees WHERE event_id = ? ORDER BY sort, amount_mnt",
    eventId,
  );
}

export async function getEventFee(id: string): Promise<EventFee | undefined> {
  return get<EventFee>("SELECT * FROM event_fees WHERE id = ?", id);
}

export async function listEventSessions(eventId: string): Promise<EventSession[]> {
  return all<EventSession>(
    "SELECT * FROM event_sessions WHERE event_id = ? ORDER BY day, sort, starts_at",
    eventId,
  );
}

/** The single event to feature on the home page: nearest upcoming, or the flagged one. */
export async function featuredEvent(): Promise<EventRow | undefined> {
  const flagged = await get<EventRow>(
    `SELECT * FROM events
     WHERE status = 'published' AND is_featured = 1
       AND COALESCE(ends_on, starts_on, '9999-12-31') >= ?
     ORDER BY starts_on LIMIT 1`,
    todayIso(),
  );
  if (flagged) return flagged;
  return (await listUpcomingEvents(1))[0];
}

/**
 * Whether an event is currently accepting registrations. Checks the manual switch and
 * both date bounds, so an administrator can pre-schedule a registration window.
 */
export function registrationState(
  event: EventRow,
): "open" | "not_yet" | "closed" | "disabled" {
  if (!event.registration_open) return "disabled";
  const today = todayIso();
  if (event.registration_opens_on && event.registration_opens_on > today) return "not_yet";
  if (event.registration_closes_on && event.registration_closes_on < today) return "closed";
  if (event.ends_on && event.ends_on < today) return "closed";
  return "open";
}

export async function countEventRegistrations(eventId: string): Promise<number> {
  return count(
    `SELECT COUNT(*) AS n FROM registrations
     WHERE event_id = ? AND attendance_status != 'cancelled'`,
    eventId,
  );
}

/* -------------------------------------------------------------------------- */
/* Registrations                                                               */
/* -------------------------------------------------------------------------- */

export async function getRegistrationByReference(reference: string): Promise<Registration | undefined> {
  return get<Registration>("SELECT * FROM registrations WHERE reference = ?", reference);
}

export async function getRegistrationById(id: string): Promise<Registration | undefined> {
  return get<Registration>("SELECT * FROM registrations WHERE id = ?", id);
}

export async function findRegistration(
  eventId: string,
  email: string,
): Promise<Registration | undefined> {
  return get<Registration>(
    `SELECT * FROM registrations
     WHERE event_id = ? AND email = ? COLLATE NOCASE AND attendance_status != 'cancelled'`,
    eventId,
    email,
  );
}

export type RegistrationWithEvent = Registration & {
  event_title_mn: string;
  event_title_en: string;
  event_slug: string;
  event_starts_on: string | null;
  event_ends_on: string | null;
};

export async function listRegistrationsForUser(userId: string): Promise<RegistrationWithEvent[]> {
  return all<RegistrationWithEvent>(
    `SELECT r.*, e.title_mn AS event_title_mn, e.title_en AS event_title_en,
            e.slug AS event_slug, e.starts_on AS event_starts_on, e.ends_on AS event_ends_on
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     WHERE r.user_id = ?
     ORDER BY e.starts_on DESC`,
    userId,
  );
}

export async function listRegistrations(filters: {
  eventId?: string;
  paymentStatus?: string;
  query?: string;
}): Promise<RegistrationWithEvent[]> {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filters.eventId) {
    where.push("r.event_id = ?");
    params.push(filters.eventId);
  }
  if (filters.paymentStatus) {
    where.push("r.payment_status = ?");
    params.push(filters.paymentStatus);
  }
  if (filters.query) {
    where.push("(r.full_name LIKE ? OR r.email LIKE ? OR r.reference LIKE ?)");
    const like = `%${filters.query}%`;
    params.push(like, like, like);
  }

  return all<RegistrationWithEvent>(
    `SELECT r.*, e.title_mn AS event_title_mn, e.title_en AS event_title_en,
            e.slug AS event_slug, e.starts_on AS event_starts_on, e.ends_on AS event_ends_on
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY r.created_at DESC
     LIMIT 500`,
    ...params,
  );
}

/* -------------------------------------------------------------------------- */
/* Guidelines                                                                  */
/* -------------------------------------------------------------------------- */

/** In-force guidelines first, then superseded ones — the register reading order. */
export async function listPublishedGuidelines(): Promise<Guideline[]> {
  return all<Guideline>(
    `SELECT * FROM guidelines
     WHERE status IN ('published', 'superseded')
     ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END,
              effective_from DESC, approved_on DESC, code`,
  );
}

export async function listAllGuidelines(): Promise<Guideline[]> {
  return all<Guideline>(
    "SELECT * FROM guidelines ORDER BY effective_from DESC, created_at DESC",
  );
}

export const getGuidelineBySlug = cache(async function getGuidelineBySlug(
  slug: string,
  includeDrafts = false,
): Promise<Guideline | undefined> {
  return get<Guideline>(
    `SELECT * FROM guidelines WHERE slug = ?${
      includeDrafts ? "" : " AND status IN ('published', 'superseded')"
    }`,
    slug,
  );
});

export async function getGuidelineById(id: string): Promise<Guideline | undefined> {
  return get<Guideline>("SELECT * FROM guidelines WHERE id = ?", id);
}

/** The guideline that replaced this one, if any. */
export async function findSuccessor(guidelineId: string): Promise<Guideline | undefined> {
  return get<Guideline>(
    "SELECT * FROM guidelines WHERE supersedes_id = ? AND status = 'published'",
    guidelineId,
  );
}

/* -------------------------------------------------------------------------- */
/* Publications                                                                */
/* -------------------------------------------------------------------------- */

export async function listPublishedPublications(limit = 100): Promise<Publication[]> {
  return all<Publication>(
    `SELECT * FROM publications WHERE status = 'published'
     ORDER BY published_on DESC, created_at DESC LIMIT ?`,
    limit,
  );
}

export async function listAllPublications(): Promise<Publication[]> {
  return all<Publication>(
    "SELECT * FROM publications ORDER BY published_on DESC, created_at DESC",
  );
}

export const getPublicationBySlug = cache(async function getPublicationBySlug(
  slug: string,
  includeDrafts = false,
): Promise<Publication | undefined> {
  return get<Publication>(
    `SELECT * FROM publications WHERE slug = ?${
      includeDrafts ? "" : " AND status = 'published'"
    }`,
    slug,
  );
});

export async function getPublicationById(id: string): Promise<Publication | undefined> {
  return get<Publication>("SELECT * FROM publications WHERE id = ?", id);
}

/* -------------------------------------------------------------------------- */
/* News                                                                        */
/* -------------------------------------------------------------------------- */

export async function listPublishedNews(limit = 20, offset = 0): Promise<NewsPost[]> {
  return all<NewsPost>(
    `SELECT * FROM news_posts
     WHERE status = 'published' AND COALESCE(published_at, created_at) <= datetime('now')
     ORDER BY COALESCE(published_at, created_at) DESC
     LIMIT ? OFFSET ?`,
    limit,
    offset,
  );
}

export async function listAllNews(): Promise<NewsPost[]> {
  return all<NewsPost>(
    "SELECT * FROM news_posts ORDER BY COALESCE(published_at, created_at) DESC",
  );
}

export const getNewsBySlug = cache(async function getNewsBySlug(
  slug: string,
  includeDrafts = false,
): Promise<NewsPost | undefined> {
  return get<NewsPost>(
    `SELECT * FROM news_posts WHERE slug = ?${
      includeDrafts ? "" : " AND status = 'published'"
    }`,
    slug,
  );
});

export async function getNewsById(id: string): Promise<NewsPost | undefined> {
  return get<NewsPost>("SELECT * FROM news_posts WHERE id = ?", id);
}

/* -------------------------------------------------------------------------- */
/* Board, history, partners                                                    */
/* -------------------------------------------------------------------------- */

export async function listBoardMembers(currentOnly = true): Promise<BoardMember[]> {
  return all<BoardMember>(
    `SELECT * FROM board_members ${currentOnly ? "WHERE is_current = 1" : ""}
     ORDER BY sort, name_mn`,
  );
}

export async function getBoardMemberById(id: string): Promise<BoardMember | undefined> {
  return get<BoardMember>("SELECT * FROM board_members WHERE id = ?", id);
}

export async function listEventPhotos(eventId: string): Promise<EventPhoto[]> {
  return all<EventPhoto>(
    "SELECT * FROM event_photos WHERE event_id = ? ORDER BY sort, created_at",
    eventId,
  );
}

/**
 * Every photograph the Society has published, with the event each one documents.
 *
 * Two sources, one list: the photographs attached to an event, and the event's own
 * cover. A cover is a photograph that happens to be doing a second job, so excluding it
 * would drop the best picture of several events on the floor.
 *
 * Each row carries its event's title, date and city, because a photograph on this site
 * is a record of something that happened and is captioned as one — never a decorative
 * plate. `tr()` reads the `_mn`/`_en` pairs, so the shape matches the rest of the site.
 */
export interface SocietyPhoto {
  id: string;
  image: string;
  alt_mn: string;
  alt_en: string;
  caption_mn: string;
  caption_en: string;
  slug: string;
  title_mn: string;
  title_en: string;
  starts_on: string | null;
  city_mn: string;
  city_en: string;
}

export async function listSocietyPhotos(limit = 8): Promise<SocietyPhoto[]> {
  return all<SocietyPhoto>(
    /*
      The union is wrapped because a compound SELECT may only be ordered by a column
      name from its result set — `starts_on IS NULL` is an expression, and SQLite
      rejects it there. Ordering outside the subquery lifts that restriction, and undated
      events sort last instead of first.
    */
    `SELECT * FROM (
       SELECT p.id, p.image, p.alt_mn, p.alt_en, p.caption_mn, p.caption_en,
              e.slug, e.title_mn, e.title_en, e.starts_on, e.city_mn, e.city_en
         FROM event_photos p
         JOIN events e ON e.id = p.event_id
        WHERE e.status = 'published' AND p.image != ''
        UNION ALL
       SELECT e.id || ':cover', e.cover_image, e.cover_alt_mn, e.cover_alt_en, '', '',
              e.slug, e.title_mn, e.title_en, e.starts_on, e.city_mn, e.city_en
         FROM events e
        WHERE e.status = 'published' AND e.cover_image != ''
     )
      ORDER BY starts_on IS NULL, starts_on DESC
      LIMIT ?`,
    limit,
  );
}

export async function listHistoryEntries(): Promise<HistoryEntry[]> {
  return all<HistoryEntry>(
    "SELECT * FROM history_entries ORDER BY year DESC, sort, happened_on DESC",
  );
}

export async function getHistoryEntryById(id: string): Promise<HistoryEntry | undefined> {
  return get<HistoryEntry>("SELECT * FROM history_entries WHERE id = ?", id);
}

export async function listPartners(): Promise<Partner[]> {
  return all<Partner>("SELECT * FROM partners ORDER BY sort, name_en");
}

export async function getPartnerById(id: string): Promise<Partner | undefined> {
  return get<Partner>("SELECT * FROM partners WHERE id = ?", id);
}

/* -------------------------------------------------------------------------- */
/* Members                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The user columns a MemberRecord carries — everything except `password_hash`. Listed
 * by name rather than `u.*` so the hash never leaves the database layer; a page that
 * spreads a record into client props cannot leak what was never selected.
 */
const USER_COLUMNS =
  "u.id, u.email, u.role, u.status, u.name_mn, u.name_en, u.last_login_at, u.created_at, u.updated_at";

const PROFILE_COLUMNS = `m.member_no, m.degree, m.specialty_mn, m.specialty_en,
            m.institution_mn, m.institution_en, m.position_mn, m.position_en,
            m.phone, m.membership_type, m.membership_status, m.joined_on,
            m.valid_until, m.notes`;

export async function getMemberRecord(userId: string): Promise<MemberRecord | undefined> {
  return get<MemberRecord>(
    `SELECT ${USER_COLUMNS}, ${PROFILE_COLUMNS}
     FROM users u
     LEFT JOIN member_profiles m ON m.user_id = u.id
     WHERE u.id = ?`,
    userId,
  );
}

export async function listMembers(filters: { status?: string; query?: string }): Promise<MemberRecord[]> {
  const where: string[] = ["u.role = 'member'"];
  const params: string[] = [];

  if (filters.status) {
    where.push("m.membership_status = ?");
    params.push(filters.status);
  }
  if (filters.query) {
    where.push("(u.name_mn LIKE ? OR u.name_en LIKE ? OR u.email LIKE ? OR m.member_no LIKE ?)");
    const like = `%${filters.query}%`;
    params.push(like, like, like, like);
  }

  return all<MemberRecord>(
    `SELECT ${USER_COLUMNS}, ${PROFILE_COLUMNS}
     FROM users u
     LEFT JOIN member_profiles m ON m.user_id = u.id
     WHERE ${where.join(" AND ")}
     ORDER BY u.created_at DESC
     LIMIT 1000`,
    ...params,
  );
}

export async function listStaffUsers(): Promise<MemberRecord[]> {
  return all<MemberRecord>(
    `SELECT ${USER_COLUMNS}, NULL AS member_no, '' AS degree, '' AS specialty_mn, '' AS specialty_en,
            '' AS institution_mn, '' AS institution_en, '' AS position_mn,
            '' AS position_en, '' AS phone, 'full' AS membership_type,
            'active' AS membership_status, NULL AS joined_on, NULL AS valid_until,
            '' AS notes
     FROM users u WHERE u.role IN ('admin', 'editor') ORDER BY u.created_at`,
  );
}

/* -------------------------------------------------------------------------- */
/* Dashboard counts                                                            */
/* -------------------------------------------------------------------------- */

export interface DashboardStats {
  activeMembers: number;
  pendingMembers: number;
  upcomingEvents: number;
  unpaidRegistrations: number;
  publishedGuidelines: number;
  draftContent: number;
}

export async function dashboardStats(): Promise<DashboardStats> {
  // Six independent counts, issued together. Awaiting them one after another would be
  // six sequential network round trips to a hosted database on every admin page load.
  const [
    activeMembers,
    pendingMembers,
    upcomingEvents,
    unpaidRegistrations,
    publishedGuidelines,
    draftContent,
  ] = await Promise.all([
    count("SELECT COUNT(*) AS n FROM member_profiles WHERE membership_status = 'active'"),
    count("SELECT COUNT(*) AS n FROM member_profiles WHERE membership_status = 'pending'"),
    count(
      `SELECT COUNT(*) AS n FROM events WHERE status = 'published'
       AND COALESCE(ends_on, starts_on, '9999-12-31') >= ?`,
      todayIso(),
    ),
    count(
      `SELECT COUNT(*) AS n FROM registrations
       WHERE payment_status IN ('unpaid', 'pending') AND attendance_status != 'cancelled'`,
    ),
    count("SELECT COUNT(*) AS n FROM guidelines WHERE status = 'published'"),
    count(
      `SELECT (SELECT COUNT(*) FROM events WHERE status = 'draft')
            + (SELECT COUNT(*) FROM guidelines WHERE status IN ('draft', 'review'))
            + (SELECT COUNT(*) FROM publications WHERE status = 'draft')
            + (SELECT COUNT(*) FROM news_posts WHERE status = 'draft') AS n`,
    ),
  ]);

  return {
    activeMembers,
    pendingMembers,
    upcomingEvents,
    unpaidRegistrations,
    publishedGuidelines,
    draftContent,
  };
}

/**
 * Events carrying a cover photograph, newest first, for the hero.
 *
 * Deliberately not restricted to past events. A congress that has been announced with a
 * photograph belongs in the hero as much as one that has happened — the point is to show
 * the Society is active, and an upcoming date says that at least as well.
 */
export async function listEventsWithCovers(limit = 4): Promise<EventRow[]> {
  return all<EventRow>(
    `SELECT * FROM events
     WHERE status = 'published' AND cover_image != ''
     ORDER BY starts_on IS NULL, starts_on DESC
     LIMIT ?`,
    limit,
  );
}
