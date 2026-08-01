import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "node:crypto";
import { get, run } from "@/lib/db";
import type { Role, User, UserStatus } from "@/lib/db/types";

export const SESSION_COOKIE = "msid_session";
const SESSION_DAYS = 14;

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  name_mn: string;
  name_en: string;
}

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or shorter than 32 characters. Generate one with `openssl rand -base64 48` and set it in .env.local.",
    );
  }
  return new TextEncoder().encode(value);
}

/**
 * Issues a session. The signed cookie carries the claim; a matching row in `sessions`
 * lets an administrator revoke access immediately instead of waiting for expiry.
 */
export async function createSession(userId: string, userAgent = ""): Promise<void> {
  const sessionId = randomUUID();
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);

  run(
    "INSERT INTO sessions (id, user_id, expires_at, user_agent) VALUES (?, ?, ?, ?)",
    sessionId,
    userId,
    expires.toISOString(),
    userAgent.slice(0, 250),
  );

  const token = await new SignJWT({ sid: sessionId, uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(secret());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      run("DELETE FROM sessions WHERE id = ?", String(payload.sid));
    } catch {
      // An unverifiable token has nothing to revoke.
    }
  }

  store.delete(SESSION_COOKIE);
}

/**
 * Resolves the signed-in user, or null. Verifies the signature, that the session row
 * still exists and has not expired, and that the account is still usable.
 */
export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let sessionId: string;
  try {
    const { payload } = await jwtVerify(token, secret());
    sessionId = String(payload.sid);
  } catch {
    return null;
  }

  const session = get<{ user_id: string; expires_at: string }>(
    "SELECT user_id, expires_at FROM sessions WHERE id = ?",
    sessionId,
  );
  if (!session) return null;

  if (new Date(session.expires_at).getTime() < Date.now()) {
    run("DELETE FROM sessions WHERE id = ?", sessionId);
    return null;
  }

  const user = get<User>(
    "SELECT id, email, role, status, name_mn, name_en FROM users WHERE id = ?",
    session.user_id,
  );
  if (!user || user.status === "suspended") return null;

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    name_mn: user.name_mn,
    name_en: user.name_en,
  };
}

export function isStaff(user: SessionUser | null): boolean {
  return user?.role === "admin" || user?.role === "editor";
}

/** Removes expired session rows. Called opportunistically on sign-in. */
export function pruneSessions(): void {
  run("DELETE FROM sessions WHERE expires_at < ?", new Date().toISOString());
}
