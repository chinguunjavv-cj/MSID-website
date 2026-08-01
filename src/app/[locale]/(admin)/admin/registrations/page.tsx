import Link from "next/link";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { listAllEvents, listRegistrations } from "@/lib/queries";
import { updateRegistrationAction } from "@/lib/actions/admin";
import { formatDateNumeric, formatMnt } from "@/lib/format";
import { StatusPill, paymentTone } from "@/components/ui/Primitives";

const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "refunded", "cancelled"] as const;
const ATTENDANCE_STATUSES = [
  "registered",
  "confirmed",
  "attended",
  "cancelled",
  "no_show",
] as const;

export default async function AdminRegistrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ event?: string; payment?: string; q?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const filters = await searchParams;
  const mn = locale === "mn";
  const t = getDictionary(locale);

  const events = listAllEvents();
  const registrations = listRegistrations({
    eventId: filters.event,
    paymentStatus: filters.payment,
    query: filters.q,
  });

  const totalPaid = registrations
    .filter((registration) => registration.payment_status === "paid")
    .reduce((sum, registration) => sum + registration.amount_mnt, 0);
  const totalOwed = registrations
    .filter((registration) => ["unpaid", "pending"].includes(registration.payment_status))
    .reduce((sum, registration) => sum + registration.amount_mnt, 0);

  const csvHref = `/api/admin/registrations.csv?${new URLSearchParams({
    ...(filters.event ? { event: filters.event } : {}),
    ...(filters.payment ? { payment: filters.payment } : {}),
    ...(filters.q ? { q: filters.q } : {}),
  }).toString()}`;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2 font-bold">{mn ? "Бүртгэл" : "Registrations"}</h1>
        <a href={csvHref} className="btn btn-secondary" download>
          {mn ? "CSV татах" : "Download CSV"}
        </a>
      </div>

      {/* Filters are a plain GET form so every view is a shareable URL. */}
      <form method="get" className="mt-6 grid gap-3 border border-ink-200 bg-ink-50 p-4 md:grid-cols-4">
        <label>
          <span className="field-label">{mn ? "Арга хэмжээ" : "Event"}</span>
          <select name="event" defaultValue={filters.event ?? ""} className="select">
            <option value="">{mn ? "Бүгд" : "All"}</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {tr(event, "title", locale)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="field-label">{mn ? "Төлбөр" : "Payment"}</span>
          <select name="payment" defaultValue={filters.payment ?? ""} className="select">
            <option value="">{mn ? "Бүгд" : "All"}</option>
            {PAYMENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t.registration.paymentStatus[status]}
              </option>
            ))}
          </select>
        </label>

        <label className="md:col-span-1">
          <span className="field-label">{mn ? "Хайх" : "Search"}</span>
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder={mn ? "Нэр, и-мэйл, дугаар" : "Name, email, reference"}
            className="input"
          />
        </label>

        <div className="flex items-end">
          <button type="submit" className="btn btn-primary w-full cursor-pointer">
            {mn ? "Шүүх" : "Filter"}
          </button>
        </div>
      </form>

      <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-3">
        <div>
          <dt className="text-label font-semibold text-ink-600">
            {mn ? "Нийт бүртгэл" : "Total registrations"}
          </dt>
          <dd className="tabular text-xl font-bold text-ink-900">{registrations.length}</dd>
        </div>
        <div>
          <dt className="text-label font-semibold text-ink-600">
            {mn ? "Төлөгдсөн" : "Collected"}
          </dt>
          <dd className="tabular text-xl font-bold text-status-active">
            {formatMnt(totalPaid, locale)}
          </dd>
        </div>
        <div>
          <dt className="text-label font-semibold text-ink-600">
            {mn ? "Хүлээгдэж буй" : "Outstanding"}
          </dt>
          <dd className="tabular text-xl font-bold text-status-pending">
            {formatMnt(totalOwed, locale)}
          </dd>
        </div>
      </dl>

      {registrations.length > 0 ? (
        <div className="table-scroll mt-8">
          <table className="data-table">
            <caption className="sr-only">{mn ? "Бүртгэл" : "Registrations"}</caption>
            <thead>
              <tr>
                <th scope="col">{mn ? "Дугаар" : "Reference"}</th>
                <th scope="col">{mn ? "Оролцогч" : "Participant"}</th>
                <th scope="col">{mn ? "Арга хэмжээ" : "Event"}</th>
                <th scope="col">{mn ? "Дүн" : "Amount"}</th>
                <th scope="col">{mn ? "Огноо" : "Registered"}</th>
                <th scope="col">{mn ? "Төлөв шинэчлэх" : "Update status"}</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((registration) => (
                <tr key={registration.id}>
                  <td>
                    <Link
                      href={localePath(locale, `/registration/${registration.reference}`)}
                      target="_blank"
                      className="tabular font-semibold text-copper-700 underline underline-offset-2"
                    >
                      {registration.reference}
                    </Link>
                    <span className="mt-1 block">
                      <StatusPill
                        label={
                          t.registration.paymentStatus[
                            registration.payment_status as (typeof PAYMENT_STATUSES)[number]
                          ]
                        }
                        tone={paymentTone(registration.payment_status)}
                      />
                    </span>
                  </td>

                  <td>
                    <span className="font-medium text-ink-900">{registration.full_name}</span>
                    <span className="mt-0.5 block text-[0.8125rem] text-ink-600">
                      {registration.email}
                    </span>
                    {registration.institution && (
                      <span className="block text-[0.8125rem] text-ink-600">
                        {registration.institution}
                      </span>
                    )}
                    {registration.is_member === 1 && (
                      <span className="pill pill-info mt-1.5 inline-flex">
                        {mn ? "Гишүүн" : "Member"}
                      </span>
                    )}
                  </td>

                  <td className="min-w-40">
                    {mn
                      ? registration.event_title_mn || registration.event_title_en
                      : registration.event_title_en || registration.event_title_mn}
                    {registration.abstract_title && (
                      <span className="mt-1 block text-[0.8125rem] text-ink-600">
                        {mn ? "Илтгэл: " : "Abstract: "}
                        {registration.abstract_title}
                      </span>
                    )}
                  </td>

                  <td className="tabular whitespace-nowrap">
                    {formatMnt(registration.amount_mnt, locale)}
                  </td>

                  <td className="tabular whitespace-nowrap">
                    {formatDateNumeric(registration.created_at.slice(0, 10))}
                  </td>

                  <td>
                    <form action={updateRegistrationAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="registrationId" value={registration.id} />
                      <select
                        name="payment_status"
                        defaultValue={registration.payment_status}
                        aria-label={mn ? "Төлбөрийн төлөв" : "Payment status"}
                        className="select w-auto min-w-32 py-1.5 text-[0.8125rem]"
                      >
                        {PAYMENT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {t.registration.paymentStatus[status]}
                          </option>
                        ))}
                      </select>
                      <select
                        name="attendance_status"
                        defaultValue={registration.attendance_status}
                        aria-label={mn ? "Оролцооны төлөв" : "Attendance status"}
                        className="select w-auto min-w-32 py-1.5 text-[0.8125rem]"
                      >
                        {ATTENDANCE_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {t.registration.attendanceStatus[status]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="btn btn-secondary cursor-pointer px-3 py-1.5 text-[0.8125rem]"
                      >
                        {mn ? "Хадгалах" : "Save"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-8 border-t border-ink-200 py-14 text-ink-600">
          {mn ? "Бүртгэл олдсонгүй." : "No registrations match these filters."}
        </p>
      )}
    </div>
  );
}
