"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  get,
  newId,
  run,
  setClause,
  transaction,
  uniqueSlug,
  type Tx,
} from "@/lib/db";
import { currentUser, isStaff, type SessionUser } from "@/lib/auth/session";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { getResource, type FieldDef, type ResourceDef } from "@/lib/admin/resources";
import { deletionBlockedReason } from "@/lib/admin/deletion";
import { notify } from "@/lib/email/mailer";
import { membershipApprovedMessage } from "@/lib/email/messages";
import { siteUrl } from "@/lib/site";
import { CONTENT_TAG } from "@/lib/queries";
import { SETTING_DEFAULTS, setSettings, type SiteSettings } from "@/lib/settings";
import { localePath } from "@/lib/i18n/config";
import type { FormState } from "@/lib/actions/types";

const localeSchema = z.enum(["mn", "en"]).catch("mn");

/**
 * Called after every write. Two caches to clear: the rendered routes (`revalidatePath`
 * on the whole tree — every page shows the footer settings, so nothing narrower is
 * honest), and the published-content data cache in `queries.ts` and `settings.ts`.
 * `updateTag` rather than `revalidateTag` because it expires the entries *now*, within
 * this action, so the redirect that follows a save renders the row just written rather
 * than the one before it.
 */
function bustContent(): void {
  revalidatePath("/", "layout");
  updateTag(CONTENT_TAG);
}

/** Throws unless the caller is signed in as admin or editor. */
async function requireStaff(): Promise<SessionUser> {
  const user = await currentUser();
  if (!isStaff(user)) throw new Error("Not authorised");
  return user as SessionUser;
}

async function requireAdmin(): Promise<SessionUser> {
  const user = await currentUser();
  if (user?.role !== "admin") throw new Error("Not authorised");
  return user;
}

/**
 * Records an administrative action. Awaited everywhere — a floating promise here would
 * mean the audit row races the redirect and is sometimes lost.
 */
async function audit(
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  meta = "",
): Promise<void> {
  await run(
    `INSERT INTO audit_log (id, user_id, action, entity, entity_id, meta)
     VALUES (?, ?, ?, ?, ?, ?)`,
    newId(),
    userId,
    action,
    entity,
    entityId,
    meta,
  );
}

/** Same, but inside an open transaction so it commits or rolls back with the work. */
async function auditTx(
  tx: Tx,
  userId: string,
  action: string,
  entity: string,
  entityId: string,
  meta = "",
): Promise<void> {
  await tx.run(
    `INSERT INTO audit_log (id, user_id, action, entity, entity_id, meta)
     VALUES (?, ?, ?, ?, ?, ?)`,
    newId(),
    userId,
    action,
    entity,
    entityId,
    meta,
  );
}

/* -------------------------------------------------------------------------- */
/* Generic resource save                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Upper bound on any free-text column written through the generic form. Far above
 * anything a real record holds — the longest body texts are a few thousand characters
 * — and there only so a single request cannot park megabytes in a row.
 */
const MAX_FIELD_LENGTH = 50_000;

/** A submitted value the field's definition does not admit. Named so the action can
 *  turn it into a field error rather than a crashed request. */
class InvalidField extends Error {
  constructor(readonly column: string) {
    super(`Invalid value for ${column}`);
  }
}

/** Reads one field's columns out of the submitted form, coerced to its kind. */
function readField(field: FieldDef, formData: FormData): Record<string, string | number | null> {
  const values: Record<string, string | number | null> = {};

  const coerce = (column: string, raw: FormDataEntryValue | null): string | number | null => {
    if (field.kind === "checkbox") return raw ? 1 : 0;
    const text = String(raw ?? "").trim();
    if (field.kind === "number") {
      if (text === "") return null;
      const n = Number(text);
      if (!Number.isFinite(n)) throw new InvalidField(column);
      return n;
    }
    if (field.kind === "date" || field.kind === "datetime") return text === "" ? null : text;
    if (field.kind === "select" && field.optionsFrom) return text === "" ? null : text;
    if (field.kind === "select" && field.options) {
      /*
        A select with a fixed option list is a closed enum, and the column behind it is
        usually a status the public site switches on. A value outside the list — a
        hand-edited request, or a stale form after the options changed — is refused
        rather than written.
      */
      if (!field.options.some((option) => option.value === text)) throw new InvalidField(column);
      return text;
    }
    return text.slice(0, MAX_FIELD_LENGTH);
  };

  if (field.bilingual) {
    values[`${field.name}_mn`] = coerce(`${field.name}_mn`, formData.get(`${field.name}_mn`));
    values[`${field.name}_en`] = coerce(`${field.name}_en`, formData.get(`${field.name}_en`));
  } else {
    values[field.name] = coerce(field.name, formData.get(field.name));
  }

  return values;
}

export async function saveResourceAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();
  const locale = localeSchema.parse(formData.get("locale"));

  const resourceKey = String(formData.get("__resource") ?? "");
  const resource = getResource(resourceKey);
  if (!resource) return { errors: ["Unknown resource"] };

  const id = String(formData.get("__id") ?? "").trim();
  const idColumn = resource.idColumn ?? "id";

  const patch: Record<string, string | number | null> = {};
  try {
    for (const field of resource.fields) Object.assign(patch, readField(field, formData));
  } catch (error) {
    if (error instanceof InvalidField) {
      return {
        errors: [locale === "mn" ? "Талбарын утга буруу байна." : "A field has an invalid value."],
        fieldErrors: { [error.column]: locale === "mn" ? "Утга буруу байна." : "Invalid value." },
      };
    }
    throw error;
  }

  // Required fields are checked against the Mongolian column, which is the primary
  // language: an English-only record would render as untranslated to most visitors.
  // A field marked `requireEither` is the exception — a foreign partner's name is
  // meant to be English-only — and passes when either language is filled in.
  const empty = (value: unknown) => value === null || value === "" || value === undefined;
  for (const field of resource.fields.filter((f) => f.required)) {
    const key = field.bilingual ? `${field.name}_mn` : field.name;
    const value = patch[key];
    const satisfiedByOther =
      field.bilingual && field.requireEither && !empty(patch[`${field.name}_en`]);
    if (empty(value) && !satisfiedByOther) {
      return {
        errors: [locale === "mn" ? "Заавал бөглөх талбар дутуу байна." : "A required field is empty."],
        fieldErrors: { [key]: locale === "mn" ? "Энэ талбарыг бөглөнө үү." : "This field is required." },
      };
    }
  }

  const isNew = !id;
  if (isNew && resource.fixed) return { errors: ["This resource cannot be created."] };

  let recordId = id;

  await transaction(async (tx) => {
    if (resource.slugFrom) {
      const base = String(patch[`${resource.slugFrom}_mn`] ?? patch[resource.slugFrom] ?? "");
      const existing = id
        ? await tx.get<{ slug: string }>(
            `SELECT slug FROM ${resource.table} WHERE ${idColumn} = ?`,
            id,
          )
        : undefined;
      // Slugs stay stable once published so existing links do not break; only a new
      // record gets one generated.
      patch.slug =
        existing?.slug ?? (await uniqueSlug(tx, resource.table, base, id || undefined));
    }

    if (isNew) {
      recordId = newId();
      const columns = Object.keys(patch);
      await tx.run(
        `INSERT INTO ${resource.table} (${idColumn}, ${columns.join(", ")})
         VALUES (?, ${columns.map(() => "?").join(", ")})`,
        recordId,
        ...columns.map((column) => patch[column]),
      );
    } else {
      const { sql, params } = setClause(patch);
      const hasUpdatedAt = resource.table !== "history_entries" && resource.table !== "board_members" && resource.table !== "partners";
      await tx.run(
        `UPDATE ${resource.table} SET ${sql}${hasUpdatedAt ? ", updated_at = datetime('now')" : ""} WHERE ${idColumn} = ?`,
        ...params,
        id,
      );
    }

    await auditTx(
      tx,
      user.id,
      isNew ? `${resource.key}.create` : `${resource.key}.update`,
      resource.key,
      recordId,
    );
  });

  bustContent();
  redirect(localePath(locale, `/admin/${resource.key}`));
}

export async function deleteResourceAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const locale = localeSchema.parse(formData.get("locale"));

  const resource = getResource(String(formData.get("__resource") ?? ""));
  if (!resource || resource.fixed) throw new Error("Cannot delete this resource");

  const id = String(formData.get("__id") ?? "");
  const idColumn = resource.idColumn ?? "id";

  // Checked again here, not only in the page that hides the button: the action is an
  // endpoint of its own.
  const blocked = await deletionBlockedReason(resource.key, id, locale);
  if (blocked) throw new Error(blocked);

  await transaction(async (tx) => {
    /*
      Children are removed explicitly rather than left to ON DELETE CASCADE. The schema
      declares the foreign keys, but SQLite only enforces them when `foreign_keys` is on
      for the connection, and a hosted libSQL server is reached over HTTP with no
      guarantee that the pragma set at connection time applies to the statement. Doing
      it here means the fee table and the programme do not accumulate rows belonging to
      events that no longer exist, whatever the server decides.
    */
    if (resource.key === "events") {
      await tx.run("DELETE FROM event_fees WHERE event_id = ?", id);
      await tx.run("DELETE FROM event_sessions WHERE event_id = ?", id);
    }

    await tx.run(`DELETE FROM ${resource.table} WHERE ${idColumn} = ?`, id);
    await auditTx(tx, user.id, `${resource.key}.delete`, resource.key, id);
  });

  bustContent();
  redirect(localePath(locale, `/admin/${resource.key}`));
}

/* -------------------------------------------------------------------------- */
/* Event fees and programme                                                    */
/* -------------------------------------------------------------------------- */

/*
  These sub-forms are staff-only, and the columns they write are read back by the
  public event page and by the registration price calculation. The schemas keep a
  mistyped or hand-crafted request from putting a negative fee, an unknown audience or
  a kilobyte of text where a room number belongs. `parse` throws on failure, which for
  a staff form means the error boundary — the honest outcome for a request the real
  form cannot produce.
*/
const shortText = z.string().trim().max(200);
const optionalId = z.string().trim().max(64);
const requiredId = z.string().trim().min(1).max(64);
const money = z.coerce.number().int().min(0).max(1_000_000_000);
const sortOrder = z.coerce.number().int().min(-10_000).max(10_000).catch(0);
const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .or(z.literal(""))
  .transform((value) => value || null);

const feeSchema = z.object({
  eventId: requiredId,
  feeId: optionalId,
  label_mn: shortText,
  label_en: shortText,
  // Unknown or missing audience falls back to the widest tier, as the old code did —
  // never to a value the price calculation does not recognise.
  audience: z.enum(["member", "non_member", "trainee", "international", "student"]).catch("non_member"),
  // An empty box coerces to 0 (a free tier); anything else out of range is refused,
  // not silently zeroed — a congress fee that quietly became free is the worse outcome.
  amount_mnt: money,
  // Empty box means "no early-bird price"; anything else is a fee like the main one.
  early_amount_mnt: z.literal("").transform(() => null).or(money),
  sort: sortOrder,
});

const sessionSchema = z.object({
  eventId: requiredId,
  sessionId: optionalId,
  day: optionalDate,
  starts_at: z.string().trim().max(20),
  ends_at: z.string().trim().max(20),
  title_mn: shortText,
  title_en: shortText,
  speaker_mn: shortText,
  speaker_en: shortText,
  room_mn: shortText,
  room_en: shortText,
  sort: sortOrder,
});

/** The named fields of a form as a plain object, for a zod schema to check. */
function formFields(formData: FormData, names: readonly string[]): Record<string, string> {
  return Object.fromEntries(names.map((name) => [name, String(formData.get(name) ?? "")]));
}

export async function saveEventFeeAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const { eventId, feeId, ...values } = feeSchema.parse(
    formFields(formData, Object.keys(feeSchema.shape)),
  );

  if (feeId) {
    const { sql, params } = setClause(values);
    await run(`UPDATE event_fees SET ${sql} WHERE id = ? AND event_id = ?`, ...params, feeId, eventId);
  } else {
    await run(
      `INSERT INTO event_fees (id, event_id, label_mn, label_en, audience, amount_mnt, early_amount_mnt, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      newId(),
      eventId,
      values.label_mn,
      values.label_en,
      values.audience,
      values.amount_mnt,
      values.early_amount_mnt,
      values.sort,
    );
  }

  await audit(user.id, "event.fee.save", "event", eventId);
  bustContent();
}

export async function deleteEventFeeAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const feeId = String(formData.get("feeId") ?? "");
  await run("DELETE FROM event_fees WHERE id = ?", feeId);
  await audit(user.id, "event.fee.delete", "event_fee", feeId);
  bustContent();
}

export async function saveEventSessionAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const { eventId, sessionId, ...values } = sessionSchema.parse(
    formFields(formData, Object.keys(sessionSchema.shape)),
  );

  if (sessionId) {
    const { sql, params } = setClause(values);
    await run(
      `UPDATE event_sessions SET ${sql} WHERE id = ? AND event_id = ?`,
      ...params,
      sessionId,
      eventId,
    );
  } else {
    const columns = Object.keys(values) as (keyof typeof values)[];
    await run(
      `INSERT INTO event_sessions (id, event_id, ${columns.join(", ")})
       VALUES (?, ?, ${columns.map(() => "?").join(", ")})`,
      newId(),
      eventId,
      ...columns.map((column) => values[column]),
    );
  }

  await audit(user.id, "event.session.save", "event", eventId);
  bustContent();
}

export async function deleteEventSessionAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const sessionId = String(formData.get("sessionId") ?? "");
  await run("DELETE FROM event_sessions WHERE id = ?", sessionId);
  await audit(user.id, "event.session.delete", "event_session", sessionId);
  bustContent();
}

/* -------------------------------------------------------------------------- */
/* Registrations                                                               */
/* -------------------------------------------------------------------------- */

export async function updateRegistrationAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const id = String(formData.get("registrationId") ?? "");

  const paymentStatus = z
    .enum(["unpaid", "pending", "paid", "refunded", "cancelled"])
    .safeParse(formData.get("payment_status"));
  const attendanceStatus = z
    .enum(["registered", "confirmed", "attended", "cancelled", "no_show"])
    .safeParse(formData.get("attendance_status"));

  const patch: Record<string, string | null> = {};

  if (paymentStatus.success) {
    patch.payment_status = paymentStatus.data;
    patch.paid_at = paymentStatus.data === "paid" ? new Date().toISOString() : null;
  }
  if (attendanceStatus.success) patch.attendance_status = attendanceStatus.data;

  /*
    Marking a registration paid also confirms attendance — that is what an
    administrator means by ticking "paid". Applied only when attendance is still at its
    initial value, so an explicit choice of "attended" or "cancelled" is never
    overwritten by the payment change.
  */
  if (paymentStatus.success && paymentStatus.data === "paid") {
    const current =
      attendanceStatus.success
        ? attendanceStatus.data
        : (
            await get<{ attendance_status: string }>(
              "SELECT attendance_status FROM registrations WHERE id = ?",
              id,
            )
          )?.attendance_status;
    if (current === "registered") patch.attendance_status = "confirmed";
  }

  const notes = formData.get("notes");
  if (notes !== null) patch.notes = String(notes).slice(0, 1000);

  const { sql, params } = setClause(patch);
  if (!sql) return;

  await run(
    `UPDATE registrations SET ${sql}, updated_at = datetime('now') WHERE id = ?`,
    ...params,
    id,
  );
  await audit(user.id, "registration.update", "registration", id, JSON.stringify(patch));
  bustContent();
}

/* -------------------------------------------------------------------------- */
/* Members                                                                     */
/* -------------------------------------------------------------------------- */

export async function updateMemberAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const userId = String(formData.get("userId") ?? "");

  const status = z
    .enum(["pending", "active", "expired", "rejected"])
    .safeParse(formData.get("membership_status"));
  const type = z
    .enum(["full", "associate", "trainee", "honorary"])
    .safeParse(formData.get("membership_type"));

  const patch: Record<string, string | null> = {};
  if (status.success) patch.membership_status = status.data;
  if (type.success) patch.membership_type = type.data;

  /*
    Each optional column is only touched when the form sent it — the member and
    registration forms share this action but not their fields — and, when sent, is held
    to its shape: an ISO date or empty for the two dates, a short string for the number.
    A malformed date is dropped rather than written, since the portal renders these
    columns straight into `formatDate` and a stray value there breaks the member's page.
  */
  const memberNo = formData.get("member_no");
  if (memberNo !== null) patch.member_no = String(memberNo).trim().slice(0, 32) || null;
  const validUntil = optionalDate.safeParse(formData.get("valid_until"));
  if (validUntil.success) patch.valid_until = validUntil.data;
  const joinedOn = optionalDate.safeParse(formData.get("joined_on"));
  if (joinedOn.success) patch.joined_on = joinedOn.data;
  const notes = formData.get("notes");
  if (notes !== null) patch.notes = String(notes).slice(0, 2000);

  /*
    Read before the write, so the email fires on the transition into `active` and not
    on every later save. An administrator correcting a typo in an active member's
    institution should not send them a second welcome.
  */
  const before = await get<{ email: string; name_mn: string; name_en: string; membership_status: string }>(
    `SELECT u.email, u.name_mn, u.name_en, m.membership_status
     FROM users u LEFT JOIN member_profiles m ON m.user_id = u.id
     WHERE u.id = ?`,
    userId,
  );
  const newlyApproved =
    status.success && status.data === "active" && before?.membership_status !== "active";

  await transaction(async (tx) => {
    const { sql, params } = setClause(patch);
    if (sql) {
      await tx.run(
        `UPDATE member_profiles SET ${sql}, updated_at = datetime('now') WHERE user_id = ?`,
        ...params,
        userId,
      );
    }

    // Approving a membership is what lets the applicant sign in for the first time.
    if (status.success) {
      const accountStatus =
        status.data === "active" ? "active" : status.data === "rejected" ? "suspended" : "pending";
      await tx.run(
        "UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?",
        accountStatus,
        userId,
      );
      if (status.data === "active") {
        await tx.run(
          "UPDATE member_profiles SET joined_on = COALESCE(joined_on, date('now')) WHERE user_id = ?",
          userId,
        );
      }
    }

    /*
      `auditTx`, not `audit`. The module-level helper takes a fresh connection, and a
      second connection writing while this transaction holds the write lock deadlocks —
      SQLITE_BUSY on a file, and the same contention against a hosted libSQL server.
      This is the mistake `Tx`'s own doc comment warns about, and it made approving a
      membership fail outright.
    */
    await auditTx(tx, user.id, "member.update", "user", userId, JSON.stringify(patch));
  });

  /*
    After the commit, never inside it. A send that took two seconds would hold the
    transaction open for two seconds, and a send that threw would roll back an approval
    the board had already made.
  */
  if (newlyApproved && before) {
    /*
      The applicant's language is not recorded, but the application wrote their name to
      the column for the language they filled the form in — so a Mongolian name means
      they were reading Mongolian.
    */
    const memberLocale = before.name_mn.trim() ? "mn" : "en";
    await notify(
      membershipApprovedMessage(
        before.email,
        memberLocale === "mn" ? before.name_mn : before.name_en,
        `${siteUrl()}${localePath(memberLocale, "/login")}`,
        memberLocale,
      ),
      "membership approval",
    );
  }

  bustContent();
}

/* -------------------------------------------------------------------------- */
/* Site settings                                                               */
/* -------------------------------------------------------------------------- */

export async function saveSettingsAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireStaff();
  const locale = localeSchema.parse(formData.get("locale"));

  /*
    Only keys the site actually defines are written. `site_settings` is a free-form
    key/value table, so without this filter any name in the request would become a row
    — harmless in itself, but a table that fills with arbitrary keys is a table nobody
    can reason about, and `getSettings()` spreads every row into the object the whole
    site reads. Values are capped: the longest legitimate setting is a hero paragraph.
  */
  const patch: Partial<SiteSettings> = {};
  for (const [key, value] of formData.entries()) {
    // `hasOwn`, not `in`: `in` would also admit `constructor`, `toString` and the rest
    // of Object.prototype as setting names.
    if (!Object.hasOwn(SETTING_DEFAULTS, key)) continue;
    patch[key as keyof SiteSettings] = String(value).slice(0, 5_000);
  }
  // Unticked checkboxes are absent from FormData entirely.
  if (!formData.has("qpay_enabled")) patch.qpay_enabled = "0";

  await setSettings(patch);
  await audit(user.id, "settings.update", "settings", "site");
  bustContent();

  return {
    errors: [],
    ok: true,
    fieldErrors: undefined,
    ...(locale ? {} : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Staff accounts                                                              */
/* -------------------------------------------------------------------------- */

export async function createStaffAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const locale = localeSchema.parse(formData.get("locale"));

  // Same email rule as sign-up and registration. The address is where the reset link
  // goes; an account with a malformed one is locked out the first time its password is
  // forgotten.
  const parsedEmail = z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email())
    .pipe(z.string().max(160))
    .safeParse(formData.get("email") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 200);
  const password = String(formData.get("password") ?? "");
  const role = z.enum(["admin", "editor"]).catch("editor").parse(formData.get("role"));

  if (!name || !String(formData.get("email") ?? "").trim()) {
    return { errors: [locale === "mn" ? "Мэдээлэл дутуу байна." : "Missing details."] };
  }
  if (!parsedEmail.success) {
    return {
      errors: [locale === "mn" ? "И-мэйл хаяг буруу байна." : "That email address is not valid."],
      fieldErrors: { email: locale === "mn" ? "И-мэйл хаяг буруу байна." : "Invalid email address." },
    };
  }
  const email = parsedEmail.data;
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      errors: [
        locale === "mn"
          ? `Нууц үг доод тал нь ${MIN_PASSWORD_LENGTH} тэмдэгт байх ёстой.`
          : `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      ],
    };
  }
  if (await get("SELECT id FROM users WHERE email = ?", email)) {
    return {
      errors: [locale === "mn" ? "Энэ и-мэйл бүртгэлтэй байна." : "That email is already registered."],
    };
  }

  const id = newId();
  await run(
    `INSERT INTO users (id, email, password_hash, role, status, name_mn, name_en)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    id,
    email,
    await hashPassword(password),
    role,
    name,
    name,
  );
  await audit(admin.id, "staff.create", "user", id, JSON.stringify({ role }));
  bustContent();

  return { errors: [], ok: true };
}

export async function updateStaffRoleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = z.enum(["admin", "editor", "member"]).safeParse(formData.get("role"));
  if (!role.success) return;

  // The last administrator cannot demote themselves out of the admin panel.
  if (userId === admin.id && role.data !== "admin") {
    const others = await get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id != ?",
      admin.id,
    );
    if (!others || others.n === 0) return;
  }

  await run("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?", role.data, userId);
  await audit(admin.id, "staff.role", "user", userId, JSON.stringify({ role: role.data }));
  bustContent();
}

export async function deleteStaffAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (userId === admin.id) return;

  await run("DELETE FROM users WHERE id = ? AND role IN ('admin','editor')", userId);
  await audit(admin.id, "staff.delete", "user", userId);
  bustContent();
}
