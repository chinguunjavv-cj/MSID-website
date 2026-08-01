"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { all, get, newId, run, setClause, transaction, uniqueSlug } from "@/lib/db";
import { currentUser, isStaff, type SessionUser } from "@/lib/auth/session";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { getResource, type FieldDef, type ResourceDef } from "@/lib/admin/resources";
import { setSettings, type SiteSettings } from "@/lib/settings";
import { localePath } from "@/lib/i18n/config";
import type { FormState } from "@/lib/actions/types";

const localeSchema = z.enum(["mn", "en"]).catch("mn");

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

function audit(userId: string, action: string, entity: string, entityId: string, meta = "") {
  run(
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

/** Reads one field's columns out of the submitted form, coerced to its kind. */
function readField(field: FieldDef, formData: FormData): Record<string, string | number | null> {
  const values: Record<string, string | number | null> = {};

  const coerce = (raw: FormDataEntryValue | null): string | number | null => {
    if (field.kind === "checkbox") return raw ? 1 : 0;
    const text = String(raw ?? "").trim();
    if (field.kind === "number") return text === "" ? null : Number(text);
    if (field.kind === "date" || field.kind === "datetime") return text === "" ? null : text;
    if (field.kind === "select" && field.optionsFrom) return text === "" ? null : text;
    return text;
  };

  if (field.bilingual) {
    values[`${field.name}_mn`] = coerce(formData.get(`${field.name}_mn`));
    values[`${field.name}_en`] = coerce(formData.get(`${field.name}_en`));
  } else {
    values[field.name] = coerce(formData.get(field.name));
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
  for (const field of resource.fields) Object.assign(patch, readField(field, formData));

  // Required fields are checked against the Mongolian column, which is the primary
  // language: an English-only record would render as untranslated to most visitors.
  for (const field of resource.fields.filter((f) => f.required)) {
    const key = field.bilingual ? `${field.name}_mn` : field.name;
    const value = patch[key];
    if (value === null || value === "" || value === undefined) {
      return {
        errors: [locale === "mn" ? "Заавал бөглөх талбар дутуу байна." : "A required field is empty."],
        fieldErrors: { [key]: locale === "mn" ? "Энэ талбарыг бөглөнө үү." : "This field is required." },
      };
    }
  }

  const isNew = !id;
  if (isNew && resource.fixed) return { errors: ["This resource cannot be created."] };

  let recordId = id;

  transaction(() => {
    if (resource.slugFrom) {
      const base = String(patch[`${resource.slugFrom}_mn`] ?? patch[resource.slugFrom] ?? "");
      const existingSlug = id
        ? get<{ slug: string }>(
            `SELECT slug FROM ${resource.table} WHERE ${idColumn} = ?`,
            id,
          )?.slug
        : undefined;
      // Slugs stay stable once published so existing links do not break; only a new
      // record gets one generated.
      patch.slug = existingSlug ?? uniqueSlug(resource.table, base, id || undefined);
    }

    if (isNew) {
      recordId = newId();
      const columns = Object.keys(patch);
      run(
        `INSERT INTO ${resource.table} (${idColumn}, ${columns.join(", ")})
         VALUES (?, ${columns.map(() => "?").join(", ")})`,
        recordId,
        ...columns.map((column) => patch[column]),
      );
    } else {
      const { sql, params } = setClause(patch);
      const hasUpdatedAt = resource.table !== "history_entries" && resource.table !== "board_members" && resource.table !== "partners";
      run(
        `UPDATE ${resource.table} SET ${sql}${hasUpdatedAt ? ", updated_at = datetime('now')" : ""} WHERE ${idColumn} = ?`,
        ...params,
        id,
      );
    }

    audit(user.id, isNew ? `${resource.key}.create` : `${resource.key}.update`, resource.key, recordId);
  });

  revalidatePath("/", "layout");
  redirect(localePath(locale, `/admin/${resource.key}`));
}

export async function deleteResourceAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const locale = localeSchema.parse(formData.get("locale"));

  const resource = getResource(String(formData.get("__resource") ?? ""));
  if (!resource || resource.fixed) throw new Error("Cannot delete this resource");

  const id = String(formData.get("__id") ?? "");
  const idColumn = resource.idColumn ?? "id";

  run(`DELETE FROM ${resource.table} WHERE ${idColumn} = ?`, id);
  audit(user.id, `${resource.key}.delete`, resource.key, id);

  revalidatePath("/", "layout");
  redirect(localePath(locale, `/admin/${resource.key}`));
}

/** Select options for a relation field, excluding the record being edited. */
export async function relationOptions(
  table: string,
  labelColumn: string,
  excludeId?: string,
): Promise<{ value: string; label: string }[]> {
  await requireStaff();
  const allowed = ["guidelines", "events", "publications"];
  if (!allowed.includes(table)) return [];

  return all<{ value: string; label: string }>(
    `SELECT id AS value, COALESCE(NULLIF(${labelColumn}_mn, ''), ${labelColumn}_en) AS label
     FROM ${table} WHERE id IS NOT ? ORDER BY created_at DESC LIMIT 200`,
    excludeId ?? null,
  );
}

/* -------------------------------------------------------------------------- */
/* Event fees and programme                                                    */
/* -------------------------------------------------------------------------- */

export async function saveEventFeeAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const eventId = String(formData.get("eventId") ?? "");
  const feeId = String(formData.get("feeId") ?? "");

  const values = {
    label_mn: String(formData.get("label_mn") ?? "").trim(),
    label_en: String(formData.get("label_en") ?? "").trim(),
    audience: String(formData.get("audience") ?? "non_member"),
    amount_mnt: Number(formData.get("amount_mnt") ?? 0) || 0,
    early_amount_mnt: formData.get("early_amount_mnt")
      ? Number(formData.get("early_amount_mnt"))
      : null,
    sort: Number(formData.get("sort") ?? 0) || 0,
  };

  if (feeId) {
    const { sql, params } = setClause(values);
    run(`UPDATE event_fees SET ${sql} WHERE id = ? AND event_id = ?`, ...params, feeId, eventId);
  } else {
    run(
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

  audit(user.id, "event.fee.save", "event", eventId);
  revalidatePath("/", "layout");
}

export async function deleteEventFeeAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const feeId = String(formData.get("feeId") ?? "");
  run("DELETE FROM event_fees WHERE id = ?", feeId);
  audit(user.id, "event.fee.delete", "event_fee", feeId);
  revalidatePath("/", "layout");
}

export async function saveEventSessionAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const eventId = String(formData.get("eventId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");

  const values = {
    day: String(formData.get("day") ?? "").trim() || null,
    starts_at: String(formData.get("starts_at") ?? "").trim(),
    ends_at: String(formData.get("ends_at") ?? "").trim(),
    title_mn: String(formData.get("title_mn") ?? "").trim(),
    title_en: String(formData.get("title_en") ?? "").trim(),
    speaker_mn: String(formData.get("speaker_mn") ?? "").trim(),
    speaker_en: String(formData.get("speaker_en") ?? "").trim(),
    room_mn: String(formData.get("room_mn") ?? "").trim(),
    room_en: String(formData.get("room_en") ?? "").trim(),
    sort: Number(formData.get("sort") ?? 0) || 0,
  };

  if (sessionId) {
    const { sql, params } = setClause(values);
    run(
      `UPDATE event_sessions SET ${sql} WHERE id = ? AND event_id = ?`,
      ...params,
      sessionId,
      eventId,
    );
  } else {
    const columns = Object.keys(values) as (keyof typeof values)[];
    run(
      `INSERT INTO event_sessions (id, event_id, ${columns.join(", ")})
       VALUES (?, ?, ${columns.map(() => "?").join(", ")})`,
      newId(),
      eventId,
      ...columns.map((column) => values[column]),
    );
  }

  audit(user.id, "event.session.save", "event", eventId);
  revalidatePath("/", "layout");
}

export async function deleteEventSessionAction(formData: FormData): Promise<void> {
  const user = await requireStaff();
  const sessionId = String(formData.get("sessionId") ?? "");
  run("DELETE FROM event_sessions WHERE id = ?", sessionId);
  audit(user.id, "event.session.delete", "event_session", sessionId);
  revalidatePath("/", "layout");
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
        : get<{ attendance_status: string }>(
            "SELECT attendance_status FROM registrations WHERE id = ?",
            id,
          )?.attendance_status;
    if (current === "registered") patch.attendance_status = "confirmed";
  }

  const notes = formData.get("notes");
  if (notes !== null) patch.notes = String(notes).slice(0, 1000);

  const { sql, params } = setClause(patch);
  if (!sql) return;

  run(
    `UPDATE registrations SET ${sql}, updated_at = datetime('now') WHERE id = ?`,
    ...params,
    id,
  );
  audit(user.id, "registration.update", "registration", id, JSON.stringify(patch));
  revalidatePath("/", "layout");
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

  const memberNo = formData.get("member_no");
  if (memberNo !== null) patch.member_no = String(memberNo).trim() || null;
  const validUntil = formData.get("valid_until");
  if (validUntil !== null) patch.valid_until = String(validUntil).trim() || null;
  const joinedOn = formData.get("joined_on");
  if (joinedOn !== null) patch.joined_on = String(joinedOn).trim() || null;
  const notes = formData.get("notes");
  if (notes !== null) patch.notes = String(notes).slice(0, 2000);

  transaction(() => {
    const { sql, params } = setClause(patch);
    if (sql) {
      run(
        `UPDATE member_profiles SET ${sql}, updated_at = datetime('now') WHERE user_id = ?`,
        ...params,
        userId,
      );
    }

    // Approving a membership is what lets the applicant sign in for the first time.
    if (status.success) {
      const accountStatus =
        status.data === "active" ? "active" : status.data === "rejected" ? "suspended" : "pending";
      run(
        "UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?",
        accountStatus,
        userId,
      );
      if (status.data === "active") {
        run(
          "UPDATE member_profiles SET joined_on = COALESCE(joined_on, date('now')) WHERE user_id = ?",
          userId,
        );
      }
    }

    audit(user.id, "member.update", "user", userId, JSON.stringify(patch));
  });

  revalidatePath("/", "layout");
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

  const patch: Partial<SiteSettings> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("__") || key === "locale") continue;
    patch[key as keyof SiteSettings] = String(value);
  }
  // Unticked checkboxes are absent from FormData entirely.
  if (!formData.has("qpay_enabled")) patch.qpay_enabled = "0";

  setSettings(patch);
  audit(user.id, "settings.update", "settings", "site");
  revalidatePath("/", "layout");

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

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = z.enum(["admin", "editor"]).catch("editor").parse(formData.get("role"));

  if (!email || !name) {
    return { errors: [locale === "mn" ? "Мэдээлэл дутуу байна." : "Missing details."] };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      errors: [
        locale === "mn"
          ? `Нууц үг доод тал нь ${MIN_PASSWORD_LENGTH} тэмдэгт байх ёстой.`
          : `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      ],
    };
  }
  if (get("SELECT id FROM users WHERE email = ?", email)) {
    return {
      errors: [locale === "mn" ? "Энэ и-мэйл бүртгэлтэй байна." : "That email is already registered."],
    };
  }

  const id = newId();
  run(
    `INSERT INTO users (id, email, password_hash, role, status, name_mn, name_en)
     VALUES (?, ?, ?, ?, 'active', ?, ?)`,
    id,
    email,
    await hashPassword(password),
    role,
    name,
    name,
  );
  audit(admin.id, "staff.create", "user", id, JSON.stringify({ role }));
  revalidatePath("/", "layout");

  return { errors: [], ok: true };
}

export async function updateStaffRoleAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const role = z.enum(["admin", "editor", "member"]).safeParse(formData.get("role"));
  if (!role.success) return;

  // The last administrator cannot demote themselves out of the admin panel.
  if (userId === admin.id && role.data !== "admin") {
    const others = get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id != ?",
      admin.id,
    );
    if (!others || others.n === 0) return;
  }

  run("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?", role.data, userId);
  audit(admin.id, "staff.role", "user", userId, JSON.stringify({ role: role.data }));
  revalidatePath("/", "layout");
}

export async function deleteStaffAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (userId === admin.id) return;

  run("DELETE FROM users WHERE id = ? AND role IN ('admin','editor')", userId);
  audit(admin.id, "staff.delete", "user", userId);
  revalidatePath("/", "layout");
}
