import "server-only";
import type { Locale } from "@/lib/db/types";
import type { MailMessage } from "@/lib/email/mailer";

/**
 * The text of the messages MSID sends.
 *
 * Written in the recipient's language, which is the one they were using on the site
 * when the message was triggered. Plain text carries the whole message; the HTML part
 * is the same words with a link made clickable, so a client that strips HTML — or a
 * reader who prefers it — loses nothing.
 */

const BRAND = "Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэг (MSID)";

/** Minimal escaping for the few values interpolated into the HTML part. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrap(bodyHtml: string): string {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#2b241f;max-width:34rem">
${bodyHtml}
<p style="margin-top:2rem;padding-top:1rem;border-top:1px solid #e3ddd9;font-size:13px;color:#6f6862">${BRAND}</p>
</div>`;
}

/** A labelled row, used for the reference/amount blocks. */
function rows(pairs: [string, string][]): { text: string; html: string } {
  const present = pairs.filter(([, value]) => value);
  return {
    text: present.map(([label, value]) => `${label}: ${value}`).join("\n"),
    html: `<table style="border-collapse:collapse;margin:1.25rem 0">${present
      .map(
        ([label, value]) =>
          `<tr><td style="padding:0.35rem 1.5rem 0.35rem 0;color:#6f6862;vertical-align:top">${escapeHtml(
            label,
          )}</td><td style="padding:0.35rem 0;font-weight:600">${escapeHtml(value)}</td></tr>`,
      )
      .join("")}</table>`,
  };
}

export function passwordResetMessage(
  to: string,
  resetUrl: string,
  locale: Locale,
  validForMinutes: number,
): MailMessage {
  const safeUrl = escapeHtml(resetUrl);

  if (locale === "mn") {
    return {
      to,
      subject: "MSID — нууц үг сэргээх",
      text: [
        "Сайн байна уу,",
        "",
        "Та MSID-ийн вэбсайтад нууц үгээ сэргээх хүсэлт илгээсэн байна. Доорх холбоосоор орж шинэ нууц үгээ тохируулна уу:",
        "",
        resetUrl,
        "",
        `Энэ холбоос ${validForMinutes} минутын дараа хүчингүй болно. Нэг л удаа ашиглах боломжтой.`,
        "",
        "Хэрэв та ийм хүсэлт илгээгээгүй бол энэ захидлыг үл тоомсорлоно уу. Таны нууц үг хэвээр байна.",
        "",
        BRAND,
      ].join("\n"),
      html: wrap(
        `<p>Сайн байна уу,</p>
<p>Та MSID-ийн вэбсайтад нууц үгээ сэргээх хүсэлт илгээсэн байна. Доорх товчоор орж шинэ нууц үгээ тохируулна уу.</p>
<p style="margin:1.5rem 0"><a href="${safeUrl}" style="display:inline-block;background:#8a4b2e;color:#ffffff;padding:0.7rem 1.25rem;text-decoration:none;font-weight:600">Нууц үг сэргээх</a></p>
<p style="font-size:13px;color:#6f6862">Товч ажиллахгүй бол дараах хаягийг хөтчийн хаягийн мөрөнд буулгана уу:<br><span style="word-break:break-all">${safeUrl}</span></p>
<p>Энэ холбоос <strong>${validForMinutes} минутын</strong> дараа хүчингүй болно. Нэг л удаа ашиглах боломжтой.</p>
<p>Хэрэв та ийм хүсэлт илгээгээгүй бол энэ захидлыг үл тоомсорлоно уу. Таны нууц үг хэвээр байна.</p>`,
      ),
    };
  }

  return {
    to,
    subject: "MSID — reset your password",
    text: [
      "Hello,",
      "",
      "Someone asked to reset the password for your account on the MSID website. Open the link below to choose a new one:",
      "",
      resetUrl,
      "",
      `This link expires in ${validForMinutes} minutes and can be used once.`,
      "",
      "If you did not ask for this, you can ignore this message. Your password has not changed.",
      "",
      BRAND,
    ].join("\n"),
    html: wrap(
      `<p>Hello,</p>
<p>Someone asked to reset the password for your account on the MSID website. Use the button below to choose a new one.</p>
<p style="margin:1.5rem 0"><a href="${safeUrl}" style="display:inline-block;background:#8a4b2e;color:#ffffff;padding:0.7rem 1.25rem;text-decoration:none;font-weight:600">Reset password</a></p>
<p style="font-size:13px;color:#6f6862">If the button does not work, paste this address into your browser:<br><span style="word-break:break-all">${safeUrl}</span></p>
<p>This link expires in <strong>${validForMinutes} minutes</strong> and can be used once.</p>
<p>If you did not ask for this, you can ignore this message. Your password has not changed.</p>`,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Membership                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Sent when the board approves an application.
 *
 * There is deliberately no matching rejection email. Turning down a colleague's
 * application to a professional society is a conversation, not a notification, and an
 * automated message would be the wrong way for MSID to have it.
 */
export function membershipApprovedMessage(
  to: string,
  name: string,
  loginUrl: string,
  locale: Locale,
): MailMessage {
  const greeting = name.trim();
  const safeUrl = escapeHtml(loginUrl);

  if (locale === "mn") {
    return {
      to,
      subject: "MSID — гишүүнчлэл батлагдлаа",
      text: [
        greeting ? `Эрхэм ${greeting},` : "Сайн байна уу,",
        "",
        "Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэгийн гишүүнчлэлийн хүсэлт тань батлагдлаа. Баяр хүргэе.",
        "",
        "Та бүртгүүлэхдээ ашигласан и-мэйл хаяг, нууц үгээрээ доорх хаягаар нэвтэрч, гишүүний хэсэгтээ орох боломжтой боллоо:",
        "",
        loginUrl,
        "",
        "Нууц үгээ мартсан бол нэвтрэх хуудсан дээрх «Нууц үгээ мартсан уу?» холбоосыг ашиглана уу.",
        "",
        BRAND,
      ].join("\n"),
      html: wrap(
        `<p>${greeting ? `Эрхэм ${escapeHtml(greeting)},` : "Сайн байна уу,"}</p>
<p>Монголын Гэдэсний Эмгэг Судлалын Нийгэмлэгийн гишүүнчлэлийн хүсэлт тань <strong>батлагдлаа</strong>. Баяр хүргэе.</p>
<p>Та бүртгүүлэхдээ ашигласан и-мэйл хаяг, нууц үгээрээ нэвтэрч, гишүүний хэсэгтээ орох боломжтой боллоо.</p>
<p style="margin:1.5rem 0"><a href="${safeUrl}" style="display:inline-block;background:#8a4b2e;color:#ffffff;padding:0.7rem 1.25rem;text-decoration:none;font-weight:600">Гишүүний хэсэгт нэвтрэх</a></p>
<p>Нууц үгээ мартсан бол нэвтрэх хуудсан дээрх «Нууц үгээ мартсан уу?» холбоосыг ашиглана уу.</p>`,
      ),
    };
  }

  return {
    to,
    subject: "MSID — your membership has been approved",
    text: [
      greeting ? `Dear ${greeting},` : "Hello,",
      "",
      "Your application to the Mongolian Society of Intestinal Disease has been approved. Welcome.",
      "",
      "You can now sign in with the email address and password you registered with:",
      "",
      loginUrl,
      "",
      'If you have forgotten your password, use the "Forgotten your password?" link on the sign-in page.',
      "",
      BRAND,
    ].join("\n"),
    html: wrap(
      `<p>${greeting ? `Dear ${escapeHtml(greeting)},` : "Hello,"}</p>
<p>Your application to the Mongolian Society of Intestinal Disease has been <strong>approved</strong>. Welcome.</p>
<p>You can now sign in with the email address and password you registered with.</p>
<p style="margin:1.5rem 0"><a href="${safeUrl}" style="display:inline-block;background:#8a4b2e;color:#ffffff;padding:0.7rem 1.25rem;text-decoration:none;font-weight:600">Go to the member area</a></p>
<p>If you have forgotten your password, use the "Forgotten your password?" link on the sign-in page.</p>`,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Event registration                                                          */
/* -------------------------------------------------------------------------- */

export interface RegistrationDetails {
  reference: string;
  eventTitle: string;
  eventDates: string;
  amount: string;
  /** Empty when MSID has not entered bank details yet. */
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
  contactEmail: string;
  registrationUrl: string;
}

/**
 * Sent as soon as a registration is taken.
 *
 * The reference number is the whole point. It is what the participant writes on the
 * bank transfer and what MSID matches the payment against, and until this existed it
 * lived nowhere but a browser tab they were about to close.
 */
export function registrationConfirmationMessage(
  to: string,
  name: string,
  details: RegistrationDetails,
  locale: Locale,
): MailMessage {
  const mn = locale === "mn";
  const free = !details.amount;
  const hasBank = Boolean(details.bankAccountNumber && details.bankAccountName);

  const summary = rows(
    mn
      ? [
          ["Лавлах дугаар", details.reference],
          ["Арга хэмжээ", details.eventTitle],
          ["Огноо", details.eventDates],
          ["Төлбөр", details.amount],
        ]
      : [
          ["Reference", details.reference],
          ["Event", details.eventTitle],
          ["Dates", details.eventDates],
          ["Amount", details.amount],
        ],
  );

  const payment = free
    ? { text: "", html: "" }
    : hasBank
      ? rows(
          mn
            ? [
                ["Банк", details.bankName],
                ["Дансны дугаар", details.bankAccountNumber],
                ["Данс эзэмшигч", details.bankAccountName],
                ["Гүйлгээний утга", details.reference],
              ]
            : [
                ["Bank", details.bankName],
                ["Account number", details.bankAccountNumber],
                ["Account name", details.bankAccountName],
                ["Payment reference", details.reference],
              ],
        )
      : { text: "", html: "" };

  if (mn) {
    const lines = [
      name.trim() ? `Эрхэм ${name.trim()},` : "Сайн байна уу,",
      "",
      "Таны бүртгэлийг хүлээн авлаа. Дэлгэрэнгүй мэдээлэл:",
      "",
      summary.text,
    ];

    if (!free && hasBank) {
      lines.push(
        "",
        "Төлбөрөө дараах данс руу шилжүүлнэ үү. Гүйлгээний утга дээр лавлах дугаараа заавал бичнэ үү — үүгээр таны төлбөрийг тааруулна:",
        "",
        payment.text,
      );
    } else if (!free) {
      lines.push(
        "",
        `Төлбөрийн мэдээллийг нийгэмлэгээс тусад нь илгээх болно. Асуух зүйл байвал ${details.contactEmail} хаягаар холбогдоно уу.`,
      );
    }

    lines.push(
      "",
      "Бүртгэлийнхээ мэдээллийг дараах хаягаар хэдийд ч харах боломжтой:",
      details.registrationUrl,
      "",
      BRAND,
    );

    return {
      to,
      subject: `MSID — бүртгэл баталгаажлаа (${details.reference})`,
      text: lines.join("\n"),
      html: wrap(
        `<p>${name.trim() ? `Эрхэм ${escapeHtml(name.trim())},` : "Сайн байна уу,"}</p>
<p>Таны бүртгэлийг хүлээн авлаа.</p>
${summary.html}
${
  !free && hasBank
    ? `<p>Төлбөрөө дараах данс руу шилжүүлнэ үү. <strong>Гүйлгээний утга дээр лавлах дугаараа заавал бичнэ үү</strong> — үүгээр таны төлбөрийг тааруулна.</p>${payment.html}`
    : !free
      ? `<p>Төлбөрийн мэдээллийг нийгэмлэгээс тусад нь илгээх болно. Асуух зүйл байвал <a href="mailto:${escapeHtml(details.contactEmail)}">${escapeHtml(details.contactEmail)}</a> хаягаар холбогдоно уу.</p>`
      : ""
}
<p style="margin:1.5rem 0"><a href="${escapeHtml(details.registrationUrl)}" style="display:inline-block;background:#8a4b2e;color:#ffffff;padding:0.7rem 1.25rem;text-decoration:none;font-weight:600">Бүртгэлээ харах</a></p>`,
      ),
    };
  }

  const lines = [
    name.trim() ? `Dear ${name.trim()},` : "Hello,",
    "",
    "We have received your registration. The details:",
    "",
    summary.text,
  ];

  if (!free && hasBank) {
    lines.push(
      "",
      "Please transfer the fee to the account below. Put your reference number in the payment description — that is how your payment is matched to your registration:",
      "",
      payment.text,
    );
  } else if (!free) {
    lines.push(
      "",
      `The Society will send payment details separately. If you have any questions, write to ${details.contactEmail}.`,
    );
  }

  lines.push("", "You can see your registration at any time here:", details.registrationUrl, "", BRAND);

  return {
    to,
    subject: `MSID — registration confirmed (${details.reference})`,
    text: lines.join("\n"),
    html: wrap(
      `<p>${name.trim() ? `Dear ${escapeHtml(name.trim())},` : "Hello,"}</p>
<p>We have received your registration.</p>
${summary.html}
${
  !free && hasBank
    ? `<p>Please transfer the fee to the account below. <strong>Put your reference number in the payment description</strong> — that is how your payment is matched to your registration.</p>${payment.html}`
    : !free
      ? `<p>The Society will send payment details separately. If you have any questions, write to <a href="mailto:${escapeHtml(details.contactEmail)}">${escapeHtml(details.contactEmail)}</a>.</p>`
      : ""
}
<p style="margin:1.5rem 0"><a href="${escapeHtml(details.registrationUrl)}" style="display:inline-block;background:#8a4b2e;color:#ffffff;padding:0.7rem 1.25rem;text-decoration:none;font-weight:600">View your registration</a></p>`,
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Notices to MSID                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Always in Mongolian: the recipient is the Society's own office, not a visitor.
 *
 * One message per event rather than a daily digest. A society this size receives a
 * handful of applications a month, and a digest would add a day's delay to every one
 * of them in exchange for saving nobody any effort.
 */
export function newApplicationNotice(
  to: string,
  applicantName: string,
  applicantEmail: string,
  adminUrl: string,
): MailMessage {
  const summary = rows([
    ["Нэр", applicantName || "—"],
    ["И-мэйл", applicantEmail],
  ]);

  return {
    to,
    subject: "MSID — гишүүнчлэлийн шинэ хүсэлт",
    text: [
      "Гишүүнчлэлийн шинэ хүсэлт ирлээ.",
      "",
      summary.text,
      "",
      "Хүсэлтийг удирдлагын хэсгээс хянаж, батална уу:",
      adminUrl,
      "",
      "Хүсэлт батлагдсаны дараа тухайн хүнд автоматаар мэдэгдэнэ.",
      "",
      BRAND,
    ].join("\n"),
    html: wrap(
      `<p>Гишүүнчлэлийн шинэ хүсэлт ирлээ.</p>
${summary.html}
<p style="margin:1.5rem 0"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#8a4b2e;color:#ffffff;padding:0.7rem 1.25rem;text-decoration:none;font-weight:600">Хүсэлтийг харах</a></p>
<p style="font-size:13px;color:#6f6862">Хүсэлт батлагдсаны дараа тухайн хүнд автоматаар мэдэгдэнэ.</p>`,
    ),
  };
}

export function newRegistrationNotice(
  to: string,
  participantName: string,
  participantEmail: string,
  eventTitle: string,
  reference: string,
  amount: string,
  adminUrl: string,
): MailMessage {
  const summary = rows([
    ["Лавлах дугаар", reference],
    ["Арга хэмжээ", eventTitle],
    ["Оролцогч", participantName],
    ["И-мэйл", participantEmail],
    ["Төлбөр", amount || "Төлбөргүй"],
  ]);

  return {
    to,
    subject: `MSID — шинэ бүртгэл (${reference})`,
    text: [
      "Арга хэмжээнд шинэ бүртгэл ирлээ.",
      "",
      summary.text,
      "",
      "Төлбөр орсны дараа удирдлагын хэсгээс төлөвийг нь «Төлсөн» болгоно уу:",
      adminUrl,
      "",
      BRAND,
    ].join("\n"),
    html: wrap(
      `<p>Арга хэмжээнд шинэ бүртгэл ирлээ.</p>
${summary.html}
<p style="margin:1.5rem 0"><a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#8a4b2e;color:#ffffff;padding:0.7rem 1.25rem;text-decoration:none;font-weight:600">Бүртгэлийг харах</a></p>
<p style="font-size:13px;color:#6f6862">Төлбөр орсны дараа төлөвийг нь «Төлсөн» болгоно уу.</p>`,
    ),
  };
}
