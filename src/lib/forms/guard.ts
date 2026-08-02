import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Spam defences for the two forms anyone on the internet can submit: the membership
 * application and the event registration.
 *
 * Both now send mail from MSID's own Gmail on every submission, which raises the stakes
 * from "junk rows in the admin" to "the Society's sending address gets a reputation" —
 * and that would take the password-reset emails down with it.
 *
 * Three checks, none of them visible to a person filling the form in honestly. There is
 * deliberately no captcha: a society this size is not worth a targeted attacker's time,
 * and a puzzle in front of a membership form costs real applicants — some of them
 * elderly clinicians on a phone — far more than it costs a script.
 */

/**
 * The honeypot's name. Chosen to look like something worth filling: a bot scanning for
 * inputs sees a plausible field, a person never sees it at all.
 */
export const HONEYPOT_FIELD = "website";

/** How quickly a form could plausibly be filled in by a human, in milliseconds. */
const MIN_FILL_MS = 3_000;

/** After this, the token is stale — the page was left open, or replayed much later. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET is missing or too short.");
  }
  return value;
}

function sign(issuedAt: string): string {
  return createHmac("sha256", secret()).update(issuedAt).digest("hex");
}

/**
 * Stamped into the form when the page renders.
 *
 * Signed, so it cannot simply be forged with a plausible-looking timestamp — without
 * that, the timing check would be one line for a script to defeat and not worth the
 * code.
 */
export function issueFormToken(): string {
  const issuedAt = String(Date.now());
  return `${issuedAt}.${sign(issuedAt)}`;
}

export type FormTokenVerdict = "ok" | "too-fast" | "expired" | "invalid";

export function checkFormToken(token: string): FormTokenVerdict {
  const [issuedAt, signature] = String(token ?? "").split(".");
  if (!issuedAt || !signature || !/^\d{10,16}$/.test(issuedAt)) return "invalid";

  const expected = Buffer.from(sign(issuedAt), "hex");
  const actual = Buffer.from(signature, "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return "invalid";
  }

  const age = Date.now() - Number(issuedAt);
  if (age < 0 || age > MAX_AGE_MS) return "expired";
  if (age < MIN_FILL_MS) return "too-fast";
  return "ok";
}

/**
 * True when the submission looks automated.
 *
 * A trip is answered with an ordinary "please try again" rather than a silent fake
 * success. Pretending to accept is better against a bot — it stops probing for what
 * tripped it — but a false positive would leave a real doctor believing they had
 * applied when nothing was recorded, and for this site that is the worse failure.
 */
export function looksAutomated(formData: FormData): boolean {
  const honeypot = String(formData.get(HONEYPOT_FIELD) ?? "").trim();
  if (honeypot) return true;

  const verdict = checkFormToken(String(formData.get("__t") ?? ""));
  return verdict === "too-fast" || verdict === "invalid";
}
