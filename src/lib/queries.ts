import { all, get, count } from "@/lib/db";
import type {
  BoardMember,
  EventFee,
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

export function getPage(key: PageKey): Page | undefined {
  return get<Page>("SELECT * FROM pages WHERE key = ?", key);
}

export function listPages(): Page[] {
  return all<Page>("SELECT * FROM pages ORDER BY key");
}

/* -------------------------------------------------------------------------- */
/* Events                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Events that have not finished yet, soonest first. An event with no end date counts
 * as upcoming until its start date passes.
 */
export function listUpcomingEvents(limit = 20): EventRow[] {
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

export function listPastEvents(limit = 50, offset = 0): EventRow[] {
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

export function countPastEvents(): number {
  return count(
    `SELECT COUNT(*) AS n FROM events
     WHERE status = 'published' AND COALESCE(ends_on, starts_on) < ?`,
    todayIso(),
  );
}

export function getEventBySlug(slug: string, includeDrafts = false): EventRow | undefined {
  return get<EventRow>(
    `SELECT * FROM events WHERE slug = ?${includeDrafts ? "" : " AND status = 'published'"}`,
    slug,
  );
}

export function getEventById(id: string): EventRow | undefined {
  return get<EventRow>("SELECT * FROM events WHERE id = ?", id);
}

export function listAllEvents(): EventRow[] {
  return all<EventRow>(
    "SELECT * FROM events ORDER BY starts_on IS NULL, starts_on DESC, created_at DESC",
  );
}

export function listEventFees(eventId: string): EventFee[] {
  return all<EventFee>(
    "SELECT * FROM event_fees WHERE event_id = ? ORDER BY sort, amount_mnt",
    eventId,
  );
}

export function getEventFee(id: string): EventFee | undefined {
  return get<EventFee>("SELECT * FROM event_fees WHERE id = ?", id);
}

export function listEventSessions(eventId: string): EventSession[] {
  return all<EventSession>(
    "SELECT * FROM event_sessions WHERE event_id = ? ORDER BY day, sort, starts_at",
    eventId,
  );
}

/** The single event to feature on the home page: nearest upcoming, or the flagged one. */
export function featuredEvent(): EventRow | undefined {
  const flagged = get<EventRow>(
    `SELECT * FROM events
     WHERE status = 'published' AND is_featured = 1
       AND COALESCE(ends_on, starts_on, '9999-12-31') >= ?
     ORDER BY starts_on LIMIT 1`,
    todayIso(),
  );
  return flagged ?? listUpcomingEvents(1)[0];
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

export function countEventRegistrations(eventId: string): number {
  return count(
    `SELECT COUNT(*) AS n FROM registrations
     WHERE event_id = ? AND attendance_status != 'cancelled'`,
    eventId,
  );
}

/* -------------------------------------------------------------------------- */
/* Registrations                                                               */
/* -------------------------------------------------------------------------- */

export function getRegistrationByReference(reference: string): Registration | undefined {
  return get<Registration>("SELECT * FROM registrations WHERE reference = ?", reference);
}

export function getRegistrationById(id: string): Registration | undefined {
  return get<Registration>("SELECT * FROM registrations WHERE id = ?", id);
}

export function findRegistration(
  eventId: string,
  email: string,
): Registration | undefined {
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

export function listRegistrationsForUser(userId: string): RegistrationWithEvent[] {
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

export function listRegistrations(filters: {
  eventId?: string;
  paymentStatus?: string;
  query?: string;
}): RegistrationWithEvent[] {
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
export function listPublishedGuidelines(): Guideline[] {
  return all<Guideline>(
    `SELECT * FROM guidelines
     WHERE status IN ('published', 'superseded')
     ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END,
              effective_from DESC, approved_on DESC, code`,
  );
}

export function listAllGuidelines(): Guideline[] {
  return all<Guideline>(
    "SELECT * FROM guidelines ORDER BY effective_from DESC, created_at DESC",
  );
}

export function getGuidelineBySlug(
  slug: string,
  includeDrafts = false,
): Guideline | undefined {
  return get<Guideline>(
    `SELECT * FROM guidelines WHERE slug = ?${
      includeDrafts ? "" : " AND status IN ('published', 'superseded')"
    }`,
    slug,
  );
}

export function getGuidelineById(id: string): Guideline | undefined {
  return get<Guideline>("SELECT * FROM guidelines WHERE id = ?", id);
}

/** The guideline that replaced this one, if any. */
export function findSuccessor(guidelineId: string): Guideline | undefined {
  return get<Guideline>(
    "SELECT * FROM guidelines WHERE supersedes_id = ? AND status = 'published'",
    guidelineId,
  );
}

/* -------------------------------------------------------------------------- */
/* Publications                                                                */
/* -------------------------------------------------------------------------- */

export function listPublishedPublications(limit = 100): Publication[] {
  return all<Publication>(
    `SELECT * FROM publications WHERE status = 'published'
     ORDER BY published_on DESC, created_at DESC LIMIT ?`,
    limit,
  );
}

export function listAllPublications(): Publication[] {
  return all<Publication>(
    "SELECT * FROM publications ORDER BY published_on DESC, created_at DESC",
  );
}

export function getPublicationBySlug(
  slug: string,
  includeDrafts = false,
): Publication | undefined {
  return get<Publication>(
    `SELECT * FROM publications WHERE slug = ?${
      includeDrafts ? "" : " AND status = 'published'"
    }`,
    slug,
  );
}

export function getPublicationById(id: string): Publication | undefined {
  return get<Publication>("SELECT * FROM publications WHERE id = ?", id);
}

/* -------------------------------------------------------------------------- */
/* News                                                                        */
/* -------------------------------------------------------------------------- */

export function listPublishedNews(limit = 20, offset = 0): NewsPost[] {
  return all<NewsPost>(
    `SELECT * FROM news_posts
     WHERE status = 'published' AND COALESCE(published_at, created_at) <= datetime('now')
     ORDER BY COALESCE(published_at, created_at) DESC
     LIMIT ? OFFSET ?`,
    limit,
    offset,
  );
}

export function listAllNews(): NewsPost[] {
  return all<NewsPost>(
    "SELECT * FROM news_posts ORDER BY COALESCE(published_at, created_at) DESC",
  );
}

export function getNewsBySlug(slug: string, includeDrafts = false): NewsPost | undefined {
  return get<NewsPost>(
    `SELECT * FROM news_posts WHERE slug = ?${
      includeDrafts ? "" : " AND status = 'published'"
    }`,
    slug,
  );
}

export function getNewsById(id: string): NewsPost | undefined {
  return get<NewsPost>("SELECT * FROM news_posts WHERE id = ?", id);
}

/* -------------------------------------------------------------------------- */
/* Board, history, partners                                                    */
/* -------------------------------------------------------------------------- */

export function listBoardMembers(currentOnly = true): BoardMember[] {
  return all<BoardMember>(
    `SELECT * FROM board_members ${currentOnly ? "WHERE is_current = 1" : ""}
     ORDER BY sort, name_mn`,
  );
}

export function getBoardMemberById(id: string): BoardMember | undefined {
  return get<BoardMember>("SELECT * FROM board_members WHERE id = ?", id);
}

export function listHistoryEntries(): HistoryEntry[] {
  return all<HistoryEntry>(
    "SELECT * FROM history_entries ORDER BY year DESC, sort, happened_on DESC",
  );
}

export function getHistoryEntryById(id: string): HistoryEntry | undefined {
  return get<HistoryEntry>("SELECT * FROM history_entries WHERE id = ?", id);
}

export function listPartners(): Partner[] {
  return all<Partner>("SELECT * FROM partners ORDER BY sort, name_en");
}

export function getPartnerById(id: string): Partner | undefined {
  return get<Partner>("SELECT * FROM partners WHERE id = ?", id);
}

/* -------------------------------------------------------------------------- */
/* Members                                                                     */
/* -------------------------------------------------------------------------- */

export function getMemberRecord(userId: string): MemberRecord | undefined {
  return get<MemberRecord>(
    `SELECT u.*, m.member_no, m.degree, m.specialty_mn, m.specialty_en,
            m.institution_mn, m.institution_en, m.position_mn, m.position_en,
            m.phone, m.membership_type, m.membership_status, m.joined_on,
            m.valid_until, m.notes
     FROM users u
     LEFT JOIN member_profiles m ON m.user_id = u.id
     WHERE u.id = ?`,
    userId,
  );
}

export function listMembers(filters: { status?: string; query?: string }): MemberRecord[] {
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
    `SELECT u.*, m.member_no, m.degree, m.specialty_mn, m.specialty_en,
            m.institution_mn, m.institution_en, m.position_mn, m.position_en,
            m.phone, m.membership_type, m.membership_status, m.joined_on,
            m.valid_until, m.notes
     FROM users u
     LEFT JOIN member_profiles m ON m.user_id = u.id
     WHERE ${where.join(" AND ")}
     ORDER BY u.created_at DESC
     LIMIT 1000`,
    ...params,
  );
}

export function listStaffUsers(): MemberRecord[] {
  return all<MemberRecord>(
    `SELECT u.*, NULL AS member_no, '' AS degree, '' AS specialty_mn, '' AS specialty_en,
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

export function dashboardStats(): DashboardStats {
  return {
    activeMembers: count(
      "SELECT COUNT(*) AS n FROM member_profiles WHERE membership_status = 'active'",
    ),
    pendingMembers: count(
      "SELECT COUNT(*) AS n FROM member_profiles WHERE membership_status = 'pending'",
    ),
    upcomingEvents: count(
      `SELECT COUNT(*) AS n FROM events WHERE status = 'published'
       AND COALESCE(ends_on, starts_on, '9999-12-31') >= ?`,
      todayIso(),
    ),
    unpaidRegistrations: count(
      `SELECT COUNT(*) AS n FROM registrations
       WHERE payment_status IN ('unpaid', 'pending') AND attendance_status != 'cancelled'`,
    ),
    publishedGuidelines: count(
      "SELECT COUNT(*) AS n FROM guidelines WHERE status = 'published'",
    ),
    draftContent: count(
      `SELECT (SELECT COUNT(*) FROM events WHERE status = 'draft')
            + (SELECT COUNT(*) FROM guidelines WHERE status IN ('draft', 'review'))
            + (SELECT COUNT(*) FROM publications WHERE status = 'draft')
            + (SELECT COUNT(*) FROM news_posts WHERE status = 'draft') AS n`,
    ),
  };
}
