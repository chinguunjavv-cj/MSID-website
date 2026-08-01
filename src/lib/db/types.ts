/**
 * Row types mirroring `schema.sql`. Hand-written rather than generated so the shape of
 * the database is readable in one place. Keep in sync with the schema.
 */

export type Locale = "mn" | "en";

export type Role = "admin" | "editor" | "member";
export type UserStatus = "pending" | "active" | "suspended";
export type MembershipType = "full" | "associate" | "trainee" | "honorary";
export type MembershipStatus = "pending" | "active" | "expired" | "rejected";

export type EventKind =
  | "congress"
  | "training"
  | "conference"
  | "webinar"
  | "case_conference";
export type ContentStatus = "draft" | "published" | "archived";
export type GuidelineStatus = "draft" | "review" | "published" | "superseded";
export type PaymentStatus = "unpaid" | "pending" | "paid" | "refunded" | "cancelled";
export type PaymentMethod = "bank_transfer" | "qpay" | "free";
export type AttendanceStatus =
  | "registered"
  | "confirmed"
  | "attended"
  | "cancelled"
  | "no_show";
export type FeeAudience =
  | "member"
  | "non_member"
  | "trainee"
  | "international"
  | "student";

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: Role;
  status: UserStatus;
  name_mn: string;
  name_en: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberProfile {
  user_id: string;
  member_no: string | null;
  degree: string;
  specialty_mn: string;
  specialty_en: string;
  institution_mn: string;
  institution_en: string;
  position_mn: string;
  position_en: string;
  phone: string;
  membership_type: MembershipType;
  membership_status: MembershipStatus;
  joined_on: string | null;
  valid_until: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type MemberRecord = User & Omit<MemberProfile, "created_at" | "updated_at">;

export interface EventRow {
  id: string;
  slug: string;
  kind: EventKind;
  status: ContentStatus;
  title_mn: string;
  title_en: string;
  summary_mn: string;
  summary_en: string;
  body_mn: string;
  body_en: string;
  venue_mn: string;
  venue_en: string;
  city_mn: string;
  city_en: string;
  starts_on: string | null;
  ends_on: string | null;
  cover_image: string;
  cover_alt_mn: string;
  cover_alt_en: string;
  registration_open: number;
  registration_opens_on: string | null;
  registration_closes_on: string | null;
  abstract_deadline: string | null;
  early_bird_deadline: string | null;
  capacity: number | null;
  external_url: string;
  video_url: string;
  is_featured: number;
  created_at: string;
  updated_at: string;
}

export interface EventFee {
  id: string;
  event_id: string;
  label_mn: string;
  label_en: string;
  audience: FeeAudience;
  amount_mnt: number;
  early_amount_mnt: number | null;
  sort: number;
}

export interface EventSession {
  id: string;
  event_id: string;
  day: string | null;
  starts_at: string;
  ends_at: string;
  title_mn: string;
  title_en: string;
  speaker_mn: string;
  speaker_en: string;
  room_mn: string;
  room_en: string;
  sort: number;
}

export interface Registration {
  id: string;
  reference: string;
  event_id: string;
  user_id: string | null;
  fee_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  institution: string;
  position: string;
  country: string;
  is_member: number;
  amount_mnt: number;
  currency: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_ref: string;
  paid_at: string | null;
  attendance_status: AttendanceStatus;
  abstract_title: string;
  notes: string;
  locale: Locale;
  created_at: string;
  updated_at: string;
}

export interface Publication {
  id: string;
  slug: string;
  kind: "article" | "issue" | "abstract" | "report";
  status: ContentStatus;
  title_mn: string;
  title_en: string;
  authors_mn: string;
  authors_en: string;
  abstract_mn: string;
  abstract_en: string;
  journal_mn: string;
  journal_en: string;
  volume: string;
  issue: string;
  pages: string;
  published_on: string | null;
  doi: string;
  external_url: string;
  file_path: string;
  cover_image: string;
  created_at: string;
  updated_at: string;
}

export interface Guideline {
  id: string;
  slug: string;
  code: string;
  version: string;
  status: GuidelineStatus;
  title_mn: string;
  title_en: string;
  summary_mn: string;
  summary_en: string;
  body_mn: string;
  body_en: string;
  category_mn: string;
  category_en: string;
  approved_on: string | null;
  effective_from: string | null;
  review_due: string | null;
  file_path: string;
  file_size: number;
  supersedes_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsPost {
  id: string;
  slug: string;
  status: ContentStatus;
  title_mn: string;
  title_en: string;
  excerpt_mn: string;
  excerpt_en: string;
  body_mn: string;
  body_en: string;
  cover_image: string;
  cover_alt_mn: string;
  cover_alt_en: string;
  video_url: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Page {
  key: string;
  title_mn: string;
  title_en: string;
  body_mn: string;
  body_en: string;
  updated_at: string;
}

export interface HistoryEntry {
  id: string;
  year: number;
  happened_on: string | null;
  title_mn: string;
  title_en: string;
  body_mn: string;
  body_en: string;
  sort: number;
}

export interface BoardMember {
  id: string;
  name_mn: string;
  name_en: string;
  role_mn: string;
  role_en: string;
  degree: string;
  institution_mn: string;
  institution_en: string;
  photo: string;
  bio_mn: string;
  bio_en: string;
  term_from: string | null;
  term_to: string | null;
  is_current: number;
  sort: number;
}

export interface Partner {
  id: string;
  name_mn: string;
  name_en: string;
  acronym: string;
  country_mn: string;
  country_en: string;
  url: string;
  logo: string;
  description_mn: string;
  description_en: string;
  kind: "society" | "academic" | "sponsor" | "government";
  sort: number;
}

/**
 * Picks the field for the active locale, falling back to the other language when the
 * requested one is empty. A partially translated record stays readable instead of
 * rendering as a blank.
 */
export function tr(
  row: object | null | undefined,
  field: string,
  locale: Locale,
): string {
  if (!row) return "";
  const record = row as Record<string, unknown>;
  const primary = record[`${field}_${locale}`];
  if (typeof primary === "string" && primary.trim()) return primary;
  const fallback = record[`${field}_${locale === "mn" ? "en" : "mn"}`];
  return typeof fallback === "string" ? fallback : "";
}

/** True when the record has content in the requested locale specifically. */
export function hasTranslation(
  row: object | null | undefined,
  field: string,
  locale: Locale,
): boolean {
  if (!row) return false;
  const value = (row as Record<string, unknown>)[`${field}_${locale}`];
  return typeof value === "string" && value.trim().length > 0;
}
