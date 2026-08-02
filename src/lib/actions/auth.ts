"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { get, newId, run, transaction } from "@/lib/db";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  currentUser,
  destroySession,
  pruneSessions,
} from "@/lib/auth/session";
import {
  checkResetThrottle,
  checkSignInThrottle,
  clearSignInAttempts,
  recordFailedSignIn,
  recordResetRequest,
} from "@/lib/auth/throttle";
import {
  RESET_TOKEN_MINUTES,
  consumeResetToken,
  issueResetToken,
  pruneResetTokens,
  resolveResetToken,
} from "@/lib/auth/reset";
import { isMailConfigured, notify, sendMail } from "@/lib/email/mailer";
import { newApplicationNotice, passwordResetMessage } from "@/lib/email/messages";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localePath } from "@/lib/i18n/config";
import { getSettings } from "@/lib/settings";
import { siteUrl } from "@/lib/site";
import type { FormState } from "@/lib/actions/types";

const localeSchema = z.enum(["mn", "en"]).catch("mn");

/* -------------------------------------------------------------------------- */
/* Sign in                                                                     */
/* -------------------------------------------------------------------------- */

export async function signInAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = localeSchema.parse(formData.get("locale"));
  const t = getDictionary(locale);

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { errors: [t.errors.formHasErrors] };

  /*
    Before the password is checked, not after: verifying one costs about 130 MB and a
    tenth of a second of CPU, so an unthrottled form is a denial-of-service tool as well
    as a guessing oracle.
  */
  const throttle = await checkSignInThrottle(email);
  if (throttle.blocked) return { errors: [t.auth.tooManyAttempts] };

  const user = await get<{
    id: string;
    password_hash: string;
    status: string;
    role: string;
  }>("SELECT id, password_hash, status, role FROM users WHERE email = ?", email);

  // Same message whether the address is unknown or the password is wrong, so the form
  // cannot be used to enumerate who holds an account.
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    await recordFailedSignIn(email);
    return { errors: [t.auth.invalidCredentials] };
  }

  if (user.status === "suspended") return { errors: [t.auth.accountSuspended] };
  if (user.status === "pending" && user.role === "member") {
    return { errors: [t.auth.accountPending] };
  }

  await Promise.all([pruneSessions(), clearSignInAttempts(email)]);
  const userAgent = (await headers()).get("user-agent") ?? "";

  /*
    Issuing the session is the first thing that reads SESSION_SECRET — anonymous page
    loads never do, because `currentUser()` returns early when there is no cookie. A
    missing or too-short secret therefore shows up only here, and only after a correct
    password, as a blank 500 on an otherwise healthy site. Name it instead.
  */
  try {
    await createSession(user.id, userAgent);
  } catch (error) {
    if ((error as Error).message?.includes("SESSION_SECRET")) {
      console.error("Sign-in failed: SESSION_SECRET is not configured correctly.");
      return { errors: [t.auth.serverMisconfigured] };
    }
    throw error;
  }

  await run("UPDATE users SET last_login_at = datetime('now') WHERE id = ?", user.id);

  const isStaff = user.role === "admin" || user.role === "editor";
  redirect(localePath(locale, isStaff ? "/admin" : "/portal"));
}

/* -------------------------------------------------------------------------- */
/* Sign out                                                                    */
/* -------------------------------------------------------------------------- */

export async function signOutAction(formData: FormData): Promise<void> {
  const locale = localeSchema.parse(formData.get("locale"));
  await destroySession();
  redirect(localePath(locale, "/"));
}

/* -------------------------------------------------------------------------- */
/* Membership application                                                      */
/* -------------------------------------------------------------------------- */

const applicationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(160)),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
  passwordConfirm: z.string(),
  phone: z.string().trim().max(40),
  degree: z.string().trim().max(60),
  specialty: z.string().trim().max(160),
  institution: z.string().trim().max(200),
  position: z.string().trim().max(160),
  membershipType: z.enum(["full", "associate", "trainee", "honorary"]).catch("full"),
});

export async function applyForMembershipAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = localeSchema.parse(formData.get("locale"));
  const t = getDictionary(locale);

  const parsed = applicationSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
    phone: formData.get("phone") ?? "",
    degree: formData.get("degree") ?? "",
    specialty: formData.get("specialty") ?? "",
    institution: formData.get("institution") ?? "",
    position: formData.get("position") ?? "",
    membershipType: formData.get("membershipType") ?? "full",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "");
      if (field === "email") fieldErrors.email = t.errors.invalidEmail;
      else if (field === "password") fieldErrors.password = t.auth.passwordTooShort;
      else fieldErrors[field] = t.errors.fieldRequired;
    }
    return { errors: [t.errors.formHasErrors], fieldErrors };
  }

  const data = parsed.data;

  if (data.password !== data.passwordConfirm) {
    return {
      errors: [t.auth.passwordMismatch],
      fieldErrors: { passwordConfirm: t.auth.passwordMismatch },
    };
  }

  if (await get("SELECT id FROM users WHERE email = ?", data.email)) {
    return { errors: [t.auth.emailTaken], fieldErrors: { email: t.auth.emailTaken } };
  }

  const passwordHash = await hashPassword(data.password);
  const userId = newId();
  const isMn = locale === "mn";

  // The applicant is created as `pending`: they cannot sign in until the executive
  // board approves the application in the admin.
  await transaction(async (tx) => {
    await tx.run(
      `INSERT INTO users (id, email, password_hash, role, status, name_mn, name_en)
       VALUES (?, ?, ?, 'member', 'pending', ?, ?)`,
      userId,
      data.email,
      passwordHash,
      isMn ? data.name : "",
      isMn ? "" : data.name,
    );

    await tx.run(
      `INSERT INTO member_profiles
         (user_id, degree, specialty_mn, specialty_en, institution_mn, institution_en,
          position_mn, position_en, phone, membership_type, membership_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      userId,
      data.degree,
      isMn ? data.specialty : "",
      isMn ? "" : data.specialty,
      isMn ? data.institution : "",
      isMn ? "" : data.institution,
      isMn ? data.position : "",
      isMn ? "" : data.position,
      data.phone,
      data.membershipType,
    );

    await tx.run(
      `INSERT INTO audit_log (id, user_id, action, entity, entity_id)
       VALUES (?, ?, 'membership.apply', 'user', ?)`,
      newId(),
      userId,
      userId,
    );
  });

  /*
    MSID is told an application is waiting. Without this, a doctor's application sits
    unread until somebody happens to open the admin — and the applicant cannot sign in
    until it is approved, so the silence is the whole delay.
  */
  const settings = await getSettings();
  if (settings.contact_email) {
    await notify(
      newApplicationNotice(
        settings.contact_email,
        data.name,
        data.email,
        `${siteUrl()}${localePath("mn", "/admin/members")}`,
      ),
      "new application notice",
    );
  }

  redirect(localePath(locale, "/membership/received"));
}

/* -------------------------------------------------------------------------- */
/* Member profile                                                              */
/* -------------------------------------------------------------------------- */

const profileSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(40),
  degree: z.string().trim().max(60),
  specialty: z.string().trim().max(160),
  institution: z.string().trim().max(200),
  position: z.string().trim().max(160),
});

export async function updateProfileAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = localeSchema.parse(formData.get("locale"));
  const t = getDictionary(locale);

  const user = await currentUser();
  if (!user) redirect(localePath(locale, "/login"));

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
    degree: formData.get("degree") ?? "",
    specialty: formData.get("specialty") ?? "",
    institution: formData.get("institution") ?? "",
    position: formData.get("position") ?? "",
  });

  if (!parsed.success) {
    return {
      errors: [t.errors.formHasErrors],
      fieldErrors: { name: t.errors.fieldRequired },
    };
  }

  const data = parsed.data;
  // Column names are chosen from a two-value literal, never taken from user input.
  const suffix = locale === "mn" ? "mn" : "en";

  await transaction(async (tx) => {
    await tx.run(
      `UPDATE users SET name_${suffix} = ?, updated_at = datetime('now') WHERE id = ?`,
      data.name,
      user.id,
    );

    await tx.run(
      `INSERT INTO member_profiles (user_id, degree, phone, specialty_${suffix},
         institution_${suffix}, position_${suffix})
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         degree = excluded.degree,
         phone = excluded.phone,
         specialty_${suffix} = excluded.specialty_${suffix},
         institution_${suffix} = excluded.institution_${suffix},
         position_${suffix} = excluded.position_${suffix},
         updated_at = datetime('now')`,
      user.id,
      data.degree,
      data.phone,
      data.specialty,
      data.institution,
      data.position,
    );
  });

  return { errors: [], ok: true };
}

/* -------------------------------------------------------------------------- */
/* Password change                                                             */
/* -------------------------------------------------------------------------- */

export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = localeSchema.parse(formData.get("locale"));
  const t = getDictionary(locale);

  const user = await currentUser();
  if (!user) redirect(localePath(locale, "/login"));

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  const stored = await get<{ password_hash: string }>(
    "SELECT password_hash FROM users WHERE id = ?",
    user.id,
  );
  if (!stored || !(await verifyPassword(currentPassword, stored.password_hash))) {
    return { errors: [t.auth.invalidCredentials] };
  }

  if (password.length < MIN_PASSWORD_LENGTH) return { errors: [t.auth.passwordTooShort] };
  if (password !== passwordConfirm) return { errors: [t.auth.passwordMismatch] };

  await run(
    "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
    await hashPassword(password),
    user.id,
  );

  // Every other session for this account is invalidated by the change.
  await run("DELETE FROM sessions WHERE user_id = ?", user.id);
  await createSession(user.id);

  return { errors: [], ok: true };
}

/* -------------------------------------------------------------------------- */
/* Password reset                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Step one: ask for a link.
 *
 * The reply is the same whether or not the address has an account. A form that says
 * "no such account" is a way to find out who is a member of a gastroenterology
 * society, which is not ours to disclose.
 */
export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = localeSchema.parse(formData.get("locale"));
  const t = getDictionary(locale);

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email || !email.includes("@")) {
    return { errors: [t.errors.invalidEmail], fieldErrors: { email: t.errors.invalidEmail } };
  }

  if (!isMailConfigured()) {
    console.error("Password reset requested but SMTP is not configured.");
    return { errors: [t.auth.resetUnavailable] };
  }

  // Throttled before the lookup, so the timing of the reply says nothing either.
  if (await checkResetThrottle(email)) return { errors: [t.auth.tooManyAttempts] };
  await recordResetRequest(email);

  const user = await get<{ id: string; status: string }>(
    "SELECT id, status FROM users WHERE email = ?",
    email,
  );

  /*
    A suspended account is not resettable — letting someone regain access to an account
    the board closed would undo the closing.
  */
  if (user && user.status !== "suspended") {
    try {
      await pruneResetTokens();
      const { token } = await issueResetToken(user.id);
      const url = `${siteUrl()}${localePath(locale, `/reset-password/${token}`)}`;
      await sendMail(passwordResetMessage(email, url, locale, RESET_TOKEN_MINUTES));
    } catch (error) {
      /*
        Logged, not shown. Telling this caller that sending failed would also tell them
        the address exists, and the person who can act on it is whoever reads the
        deployment logs.
      */
      console.error("Password reset email failed", error);
    }
  }

  return { errors: [], ok: true };
}

/**
 * Step two: set the new password.
 *
 * On success every session for the account is cut, including any the attacker may hold
 * if the reset was prompted by a suspected compromise, and the person signs in again
 * with the password they just chose.
 */
export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const locale = localeSchema.parse(formData.get("locale"));
  const t = getDictionary(locale);

  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  const userId = await resolveResetToken(token);
  if (!userId) return { errors: [t.auth.resetLinkInvalid] };

  if (password.length < MIN_PASSWORD_LENGTH) {
    return { errors: [t.auth.passwordTooShort], fieldErrors: { password: t.auth.passwordTooShort } };
  }
  if (password !== passwordConfirm) {
    return {
      errors: [t.auth.passwordMismatch],
      fieldErrors: { passwordConfirm: t.auth.passwordMismatch },
    };
  }

  const passwordHash = await hashPassword(password);

  await transaction(async (tx) => {
    await tx.run(
      "UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?",
      passwordHash,
      userId,
    );
    await tx.run("DELETE FROM sessions WHERE user_id = ?", userId);
    await tx.run(
      `INSERT INTO audit_log (id, user_id, action, entity, entity_id)
       VALUES (?, ?, 'password.reset', 'user', ?)`,
      newId(),
      userId,
      userId,
    );
  });

  await consumeResetToken(token);

  // The account is usable again, so any sign-in lockout on it should lift.
  const account = await get<{ email: string }>("SELECT email FROM users WHERE id = ?", userId);
  if (account) await clearSignInAttempts(account.email);

  redirect(`${localePath(locale, "/login")}?reset=1`);
}
