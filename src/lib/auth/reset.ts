import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { get, run } from "@/lib/db";

/**
 * Password reset tokens.
 *
 * The token is 32 random bytes, handed out once in a link and never stored. What the
 * database keeps is its SHA-256, so someone who reads the table cannot reset anyone's
 * password with what they find there.
 *
 * SHA-256 rather than scrypt: the hashing here is not defending a low-entropy secret
 * the way password hashing is. A 256-bit random token has no guessable structure, so
 * the only thing needed is a one-way function, and a fast one keeps the lookup cheap.
 */

export const RESET_TOKEN_MINUTES = 60;

/** Bare hex, so the token survives being pasted out of an email client unharmed. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedReset {
  /** Goes in the link. Never persisted. */
  token: string;
  expiresAt: Date;
}

export async function issueResetToken(userId: string): Promise<IssuedReset> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000);

  /*
    Any outstanding link for this account stops working. Asking for a second reset
    while the first email is still in the inbox should leave exactly one live link,
    not two.
  */
  await run("DELETE FROM password_resets WHERE user_id = ?", userId);

  await run(
    "INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
    hashToken(token),
    userId,
    expiresAt.toISOString(),
  );

  return { token, expiresAt };
}

/**
 * Returns the user the token belongs to, or null when it is unknown, expired or spent.
 * Does not consume it — the reset form needs to render before anything is changed.
 */
export async function resolveResetToken(token: string): Promise<string | null> {
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;

  const row = await get<{ token_hash: string; user_id: string; expires_at: string; used_at: string | null }>(
    "SELECT token_hash, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?",
    hashToken(token),
  );
  if (!row || row.used_at) return null;

  /*
    The lookup above already matched on the hash, so this comparison can only fail if
    the row was somehow returned for a different key. It is constant-time out of
    habit rather than necessity, and costs nothing.
  */
  const expected = Buffer.from(row.token_hash, "hex");
  const actual = Buffer.from(hashToken(token), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  if (new Date(row.expires_at).getTime() < Date.now()) {
    await run("DELETE FROM password_resets WHERE token_hash = ?", row.token_hash);
    return null;
  }

  return row.user_id;
}

/** Marks the token spent. Called once the new password is committed. */
export async function consumeResetToken(token: string): Promise<void> {
  await run(
    "UPDATE password_resets SET used_at = datetime('now') WHERE token_hash = ?",
    hashToken(token),
  );
}

/** Housekeeping, run opportunistically when a reset is requested. */
export async function pruneResetTokens(): Promise<void> {
  await run("DELETE FROM password_resets WHERE expires_at < datetime('now', '-1 day')");
}
