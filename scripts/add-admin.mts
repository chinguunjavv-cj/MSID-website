/**
 * Creates or promotes an administrator.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_NAME="Таны нэр" ADMIN_PASSWORD='…' npm run admin
 *
 * Credentials come from the environment rather than command-line arguments, so they do
 * not end up in shell history or in the process list. Nothing is written to the repo.
 *
 * If the email already exists the account is promoted to `admin` and activated, and the
 * password is reset only when ADMIN_PASSWORD is supplied — so this is also the recovery
 * path for a forgotten password.
 */

import { db, get, newId, run } from "../src/lib/db/index.ts";
import { hashPassword, MIN_PASSWORD_LENGTH } from "../src/lib/auth/password.ts";

db();

const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const name = (process.env.ADMIN_NAME ?? "").trim();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!email) {
  console.error("ADMIN_EMAIL is required.");
  process.exit(1);
}

const existing = get<{ id: string; role: string }>(
  "SELECT id, role FROM users WHERE email = ?",
  email,
);

if (existing) {
  run(
    `UPDATE users SET role = 'admin', status = 'active',
       name_mn = COALESCE(NULLIF(?, ''), name_mn),
       name_en = COALESCE(NULLIF(?, ''), name_en),
       updated_at = datetime('now')
     WHERE id = ?`,
    name,
    name,
    existing.id,
  );

  if (password) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      process.exit(1);
    }
    run(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      await hashPassword(password),
      existing.id,
    );
    // Any existing sessions are cut, so a password reset actually locks others out.
    run("DELETE FROM sessions WHERE user_id = ?", existing.id);
    console.log(`Updated ${email}: role=admin, password reset.`);
  } else {
    console.log(`Updated ${email}: role=admin (password unchanged).`);
  }
} else {
  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `ADMIN_PASSWORD is required for a new account and must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    );
    process.exit(1);
  }

  const id = newId();
  run(
    `INSERT INTO users (id, email, password_hash, role, status, name_mn, name_en)
     VALUES (?, ?, ?, 'admin', 'active', ?, ?)`,
    id,
    email,
    await hashPassword(password),
    name,
    name,
  );
  run(
    `INSERT INTO audit_log (id, user_id, action, entity, entity_id, meta)
     VALUES (?, ?, 'staff.create', 'user', ?, '{"via":"add-admin script"}')`,
    newId(),
    id,
    id,
  );
  console.log(`Created administrator ${email}.`);
}

console.log("Sign in at /mn/admin");
