import Link from "next/link";
import { notFound } from "next/navigation";
import { all } from "@/lib/db";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { dashboardStats, listRegistrations } from "@/lib/queries";
import { getSettings, hasBankDetails } from "@/lib/settings";
import { qpayConfigured } from "@/lib/payments/qpay";
import { formatDateNumeric, formatMnt } from "@/lib/format";
import { Notice, StatusPill, paymentTone } from "@/components/ui/Primitives";

export default async function AdminDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const mn = locale === "mn";
  const t = getDictionary(locale);
  const stats = dashboardStats();
  const settings = getSettings();
  const recent = listRegistrations({}).slice(0, 8);

  const audit = all<{
    id: string;
    action: string;
    entity: string;
    created_at: string;
  }>("SELECT id, action, entity, created_at FROM audit_log ORDER BY created_at DESC LIMIT 8");

  const tiles = [
    {
      label: mn ? "Хүчинтэй гишүүд" : "Active members",
      value: stats.activeMembers,
      href: "/admin/members?status=active",
    },
    {
      label: mn ? "Хүлээгдэж буй хүсэлт" : "Pending applications",
      value: stats.pendingMembers,
      href: "/admin/members?status=pending",
    },
    {
      label: mn ? "Удахгүй болох арга хэмжээ" : "Upcoming events",
      value: stats.upcomingEvents,
      href: "/admin/events",
    },
    {
      label: mn ? "Төлбөр хүлээгдэж буй" : "Awaiting payment",
      value: stats.unpaidRegistrations,
      href: "/admin/registrations?payment=unpaid",
    },
    {
      label: mn ? "Хүчин төгөлдөр заавар" : "Guidelines in force",
      value: stats.publishedGuidelines,
      href: "/admin/guidelines",
    },
    {
      label: mn ? "Нийтлээгүй ноорог" : "Unpublished drafts",
      value: stats.draftContent,
      href: "/admin/events",
    },
  ];

  // Setup gaps that would silently break a real registration, surfaced rather than
  // left for someone to discover after a participant tries to pay.
  const warnings: string[] = [];
  if (!hasBankDetails(settings)) {
    warnings.push(
      mn
        ? "Банкны дансны мэдээлэл оруулаагүй байна. Бүртгүүлсэн хүмүүст төлбөрийн заавар харагдахгүй."
        : "No bank account details have been entered. Participants will not see payment instructions.",
    );
  }
  if (settings.qpay_enabled === "1" && !qpayConfigured()) {
    warnings.push(
      mn
        ? "QPay идэвхжүүлсэн боловч QPAY_* орчны хувьсагчид тохируулаагүй байна."
        : "QPay is switched on but the QPAY_* environment variables are not set.",
    );
  }

  return (
    <div>
      <h1 className="text-h2 font-bold">{mn ? "Хяналтын самбар" : "Dashboard"}</h1>

      {warnings.length > 0 && (
        <div className="mt-6 space-y-3">
          {warnings.map((warning) => (
            <Notice key={warning} tone="pending">
              {warning}{" "}
              <Link
                href={localePath(locale, "/admin/settings")}
                className="font-semibold underline underline-offset-2"
              >
                {mn ? "Тохиргоо" : "Settings"} →
              </Link>
            </Notice>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-px overflow-hidden border border-ink-200 bg-ink-200 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={localePath(locale, tile.href)}
            className="group bg-paper p-5 transition-colors duration-100 hover:bg-ink-50"
          >
            <p className="text-label font-semibold text-ink-600">{tile.label}</p>
            <p className="tabular mt-2 text-3xl font-bold text-ink-900 group-hover:text-copper-700">
              {tile.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-12 grid gap-12 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section>
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-h3 font-bold">
              {mn ? "Сүүлийн бүртгэл" : "Recent registrations"}
            </h2>
            <Link
              href={localePath(locale, "/admin/registrations")}
              className="text-small font-semibold text-copper-700 underline underline-offset-2"
            >
              {mn ? "Бүгд" : "All"} →
            </Link>
          </div>

          {recent.length > 0 ? (
            <div className="table-scroll mt-4">
              <table className="data-table">
                <caption className="sr-only">
                  {mn ? "Сүүлийн бүртгэл" : "Recent registrations"}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{mn ? "Дугаар" : "Reference"}</th>
                    <th scope="col">{mn ? "Нэр" : "Name"}</th>
                    <th scope="col">{mn ? "Арга хэмжээ" : "Event"}</th>
                    <th scope="col">{mn ? "Дүн" : "Amount"}</th>
                    <th scope="col">{mn ? "Төлөв" : "Status"}</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((registration) => (
                    <tr key={registration.id}>
                      <td className="tabular font-semibold">{registration.reference}</td>
                      <td>{registration.full_name}</td>
                      <td>
                        {mn
                          ? registration.event_title_mn || registration.event_title_en
                          : registration.event_title_en || registration.event_title_mn}
                      </td>
                      <td className="tabular whitespace-nowrap">
                        {formatMnt(registration.amount_mnt, locale)}
                      </td>
                      <td>
                        <StatusPill
                          label={
                            t.registration.paymentStatus[
                              registration.payment_status as keyof typeof t.registration.paymentStatus
                            ]
                          }
                          tone={paymentTone(registration.payment_status)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="mt-4 border-t border-ink-200 py-10 text-ink-600">
              {mn ? "Бүртгэл хараахан ирээгүй байна." : "No registrations yet."}
            </p>
          )}
        </section>

        <section>
          <h2 className="text-h3 font-bold">{mn ? "Сүүлийн үйлдэл" : "Recent activity"}</h2>
          {audit.length > 0 ? (
            <ul className="register mt-4">
              {audit.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-baseline justify-between gap-4 border-b border-ink-200 py-2.5 text-small"
                >
                  <span className="text-ink-800">{entry.action}</span>
                  <time
                    dateTime={entry.created_at}
                    className="tabular shrink-0 text-[0.8125rem] text-ink-600"
                  >
                    {formatDateNumeric(entry.created_at.slice(0, 10))}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 border-t border-ink-200 py-10 text-ink-600">
              {mn ? "Бүртгэл алга." : "Nothing recorded yet."}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
