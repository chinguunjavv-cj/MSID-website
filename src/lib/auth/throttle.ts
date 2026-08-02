import "server-only";
import { headers } from "next/headers";
import { count, newId, run } from "@/lib/db";

/**
 * Sign-in throttling.
 *
 * MSID's admin panel has two accounts on it, both belonging to real people who can be
 * named from the society's own Facebook page. Without a limit, the sign-in form is an
 * open guessing oracle against those two addresses.
 *
 * It is also a cost control. Verifying a password runs scrypt at the OWASP parameters —
 * roughly 130 MB of memory and a tenth of a second of CPU per attempt — so an
 * unthrottled form lets one script exhaust a serverless function's memory and run up
 * the bill without ever guessing anything. That is why the check happens *before* the
 * password is verified.
 *
 * Two limits from one table: the email address being attacked, and the address doing
 * the attacking. Either one tripping is enough to refuse.
 */

const WINDOW_MINUTES = 15;
const MAX_PER_EMAIL = 8;
const MAX_PER_IP = 30;

/** The client address, as far as the platform will tell us. */
async function clientAddress(): Promise<string> {
  const store = await headers();
  /*
    On Vercel `x-forwarded-for` is set by the platform and the left-most entry is the
    real client. Behind a container's own reverse proxy the same header is whatever that
    proxy wrote. It is spoofable in a deployment that does not sit behind a trusted
    proxy — which is why the per-email limit exists as well, and does not depend on it.
  */
  const forwarded = store.get("x-forwarded-for") ?? "";
  const first = forwarded.split(",")[0]?.trim();
  return first || store.get("x-real-ip") || "unknown";
}

async function recentFailures(identity: string): Promise<number> {
  return count(
    `SELECT COUNT(*) AS n FROM login_attempts
     WHERE identity = ? AND attempted_at > datetime('now', ?)`,
    identity,
    `-${WINDOW_MINUTES} minutes`,
  );
}

export interface ThrottleVerdict {
  blocked: boolean;
  /** Whole minutes the caller should wait, for the message shown to them. */
  retryInMinutes: number;
}

/** Checked before the password is verified, never after. */
export async function checkSignInThrottle(email: string): Promise<ThrottleVerdict> {
  const [byEmail, byAddress] = await Promise.all([
    recentFailures(`email:${email}`),
    recentFailures(`ip:${await clientAddress()}`),
  ]);

  const blocked = byEmail >= MAX_PER_EMAIL || byAddress >= MAX_PER_IP;
  return { blocked, retryInMinutes: WINDOW_MINUTES };
}

export async function recordFailedSignIn(email: string): Promise<void> {
  const address = await clientAddress();
  await Promise.all([
    run(
      "INSERT INTO login_attempts (id, identity) VALUES (?, ?)",
      newId(),
      `email:${email}`,
    ),
    run("INSERT INTO login_attempts (id, identity) VALUES (?, ?)", newId(), `ip:${address}`),
    // Opportunistic prune, so the table cannot grow without bound on a site with no
    // scheduled jobs.
    run("DELETE FROM login_attempts WHERE attempted_at < datetime('now', '-1 day')"),
  ]);
}

/** A correct password clears the account's own counter — but not the address's. */
export async function clearSignInAttempts(email: string): Promise<void> {
  await run("DELETE FROM login_attempts WHERE identity = ?", `email:${email}`);
}

/* -------------------------------------------------------------------------- */
/* Password reset requests                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Tighter than sign-in, because every request here sends real mail. Without a limit,
 * the form is a way to have MSID's own address deliver a stranger a hundred messages —
 * which is how a sending address gets a spam reputation it cannot easily shed.
 */
const MAX_RESETS_PER_EMAIL = 3;
const MAX_RESETS_PER_IP = 10;

export async function checkResetThrottle(email: string): Promise<boolean> {
  const [byEmail, byAddress] = await Promise.all([
    recentFailures(`reset:${email}`),
    recentFailures(`reset-ip:${await clientAddress()}`),
  ]);
  return byEmail >= MAX_RESETS_PER_EMAIL || byAddress >= MAX_RESETS_PER_IP;
}

/* -------------------------------------------------------------------------- */
/* Public form submissions                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Per-address limits for the two forms anyone can submit.
 *
 * Generous on purpose. A Mongolian hospital puts its whole staff behind one address, so
 * a limit tight enough to stop a determined script would also stop the third colleague
 * signing up for the same congress. These numbers stop a machine writing thousands of
 * rows and sending thousands of notifications, and leave any plausible human alone.
 */
const FORM_WINDOW_MINUTES = 60;
const MAX_APPLICATIONS_PER_HOUR = 10;
const MAX_REGISTRATIONS_PER_HOUR = 20;

async function recentInWindow(identity: string, minutes: number): Promise<number> {
  return count(
    `SELECT COUNT(*) AS n FROM login_attempts
     WHERE identity = ? AND attempted_at > datetime('now', ?)`,
    identity,
    `-${minutes} minutes`,
  );
}

export type PublicForm = "apply" | "register";

export async function checkFormThrottle(form: PublicForm): Promise<boolean> {
  const limit = form === "apply" ? MAX_APPLICATIONS_PER_HOUR : MAX_REGISTRATIONS_PER_HOUR;
  const seen = await recentInWindow(
    `${form}:${await clientAddress()}`,
    FORM_WINDOW_MINUTES,
  );
  return seen >= limit;
}

/** Recorded on every submission, accepted or not — a rejected attempt still cost work. */
export async function recordFormSubmission(form: PublicForm): Promise<void> {
  await run(
    "INSERT INTO login_attempts (id, identity) VALUES (?, ?)",
    newId(),
    `${form}:${await clientAddress()}`,
  );
}

/**
 * Recorded for every request, not only the ones that match an account — otherwise the
 * limit would apply to real users and not to someone working through a list of guessed
 * addresses.
 */
export async function recordResetRequest(email: string): Promise<void> {
  const address = await clientAddress();
  await Promise.all([
    run("INSERT INTO login_attempts (id, identity) VALUES (?, ?)", newId(), `reset:${email}`),
    run("INSERT INTO login_attempts (id, identity) VALUES (?, ?)", newId(), `reset-ip:${address}`),
  ]);
}
