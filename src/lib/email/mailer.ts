import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing mail.
 *
 * MSID has a Gmail address and no domain of their own yet, so this speaks SMTP with an
 * app password rather than using a transactional provider — those need a domain to
 * verify before they will send anything. Gmail allows a few hundred messages a day,
 * which is far beyond what a society of this size sends.
 *
 * Nothing here is Gmail-specific: host, port and credentials all come from the
 * environment, so moving to Resend, Postmark or a university mail server later is a
 * change of environment variables, not of code.
 *
 * Configuration (all required before any mail is sent):
 *   SMTP_HOST      smtp.gmail.com
 *   SMTP_PORT      465
 *   SMTP_USER      ibdmsid@gmail.com
 *   SMTP_PASSWORD  a Google App Password — NOT the account password
 *   MAIL_FROM      optional display form, e.g. "MSID <ibdmsid@gmail.com>"
 */

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain text is the message. HTML is an enhancement, and is optional. */
  text: string;
  html?: string;
}

function config() {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  if (!host || !user || !password) return null;

  const port = Number(process.env.SMTP_PORT ?? 465);
  return {
    host,
    port,
    // 465 is implicit TLS; 587 upgrades with STARTTLS.
    secure: port === 465,
    auth: { user, pass: password },
    from: process.env.MAIL_FROM?.trim() || `MSID <${user}>`,
  };
}

/**
 * Whether mail can be sent at all.
 *
 * Pages ask this before offering something that depends on email — a password reset
 * form that silently goes nowhere is worse than one that says up front to ring the
 * Society instead.
 */
export function isMailConfigured(): boolean {
  return config() !== null;
}

/** One transport per process; opening an SMTP connection per message is wasteful. */
type GlobalWithMail = typeof globalThis & { __msidMail?: Transporter };

function transport(): Transporter | null {
  const settings = config();
  if (!settings) return null;

  const globalRef = globalThis as GlobalWithMail;
  globalRef.__msidMail ??= nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.auth,
  });
  return globalRef.__msidMail;
}

/**
 * Sends a message. Throws when mail is not configured or the server rejects it —
 * callers decide what that means, because it differs: a failed password reset must tell
 * the person, while a failed notification to MSID should not break the thing it was
 * notifying about.
 */
export async function sendMail(message: MailMessage): Promise<void> {
  const settings = config();
  const mailer = transport();
  if (!settings || !mailer) {
    throw new Error(
      "Mail is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD.",
    );
  }

  await mailer.sendMail({
    from: settings.from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });
}
