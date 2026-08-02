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
