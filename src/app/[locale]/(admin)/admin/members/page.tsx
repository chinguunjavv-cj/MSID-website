import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { requireStaffPage } from "@/lib/auth/session";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { listMembers } from "@/lib/queries";
import { updateMemberAction } from "@/lib/actions/admin";
import { formatDateNumeric } from "@/lib/format";
import { StatusPill, membershipTone } from "@/components/ui/Primitives";

const STATUSES = ["pending", "active", "expired", "rejected"] as const;
const TYPES = ["full", "associate", "trainee", "honorary"] as const;

export default async function AdminMembersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireStaffPage(locale);

  const filters = await searchParams;
  const mn = locale === "mn";
  const t = getDictionary(locale);
  const members = await listMembers({ status: filters.status, query: filters.q });

  const pending = members.filter((member) => member.membership_status === "pending").length;

  return (
    <div>
      <h1 className="text-h2 font-bold">{mn ? "Гишүүд" : "Members"}</h1>
      {pending > 0 && (
        <p className="mt-3 text-ink-700">
          {mn
            ? `Гишүүнээр элсэх ${pending} хүсэлт хянагдахыг хүлээж байна. "Хүчинтэй" болгосноор тухайн хүн системд нэвтрэх эрхтэй болно.`
            : `${pending} application${pending === 1 ? "" : "s"} awaiting review. Setting a member to "Active" is what lets them sign in.`}
        </p>
      )}

      <form method="get" className="mt-6 grid gap-3 border border-ink-200 bg-ink-50 p-4 md:grid-cols-3">
        <label>
          <span className="field-label">{mn ? "Төлөв" : "Status"}</span>
          <select name="status" defaultValue={filters.status ?? ""} className="select">
            <option value="">{mn ? "Бүгд" : "All"}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t.membership.status[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">{mn ? "Хайх" : "Search"}</span>
          <input
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder={mn ? "Нэр, и-мэйл, дугаар" : "Name, email, member no."}
            className="input"
          />
        </label>
        <div className="flex items-end">
          <button type="submit" className="btn btn-primary w-full cursor-pointer">
            {mn ? "Шүүх" : "Filter"}
          </button>
        </div>
      </form>

      {members.length > 0 ? (
        <div className="table-scroll mt-8">
          <table className="data-table">
            <caption className="sr-only">{mn ? "Гишүүд" : "Members"}</caption>
            <thead>
              <tr>
                <th scope="col">{mn ? "Гишүүн" : "Member"}</th>
                <th scope="col">{mn ? "Мэргэжил" : "Professional"}</th>
                <th scope="col">{mn ? "Элссэн" : "Applied"}</th>
                <th scope="col">{mn ? "Гишүүнчлэл шинэчлэх" : "Update membership"}</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td className="min-w-48">
                    <span className="font-medium text-ink-900">
                      {member.degree && `${member.degree} `}
                      {tr(member, "name", locale) || "—"}
                    </span>
                    <span className="mt-0.5 block text-[0.8125rem] text-ink-600">
                      {member.email}
                    </span>
                    {member.phone && (
                      <span className="block text-[0.8125rem] text-ink-600">
                        {member.phone}
                      </span>
                    )}
                    <span className="mt-1.5 block">
                      <StatusPill
                        label={
                          t.membership.status[
                            (member.membership_status ??
                              "pending") as (typeof STATUSES)[number]
                          ]
                        }
                        tone={membershipTone(member.membership_status ?? "pending")}
                      />
                    </span>
                  </td>

                  <td className="min-w-40">
                    {tr(member, "specialty", locale) && (
                      <span className="block">{tr(member, "specialty", locale)}</span>
                    )}
                    {tr(member, "institution", locale) && (
                      <span className="block text-[0.8125rem] text-ink-600">
                        {tr(member, "institution", locale)}
                      </span>
                    )}
                    {tr(member, "position", locale) && (
                      <span className="block text-[0.8125rem] text-ink-600">
                        {tr(member, "position", locale)}
                      </span>
                    )}
                  </td>

                  <td className="tabular whitespace-nowrap">
                    {formatDateNumeric(member.created_at.slice(0, 10))}
                  </td>

                  <td>
                    <form action={updateMemberAction} className="grid gap-2 sm:grid-cols-2">
                      <input type="hidden" name="userId" value={member.id} />

                      <label className="sm:col-span-1">
                        <span className="sr-only">{mn ? "Төлөв" : "Status"}</span>
                        <select
                          name="membership_status"
                          defaultValue={member.membership_status ?? "pending"}
                          className="select py-1.5 text-[0.8125rem]"
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {t.membership.status[status]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="sm:col-span-1">
                        <span className="sr-only">{mn ? "Төрөл" : "Type"}</span>
                        <select
                          name="membership_type"
                          defaultValue={member.membership_type ?? "full"}
                          className="select py-1.5 text-[0.8125rem]"
                        >
                          {TYPES.map((type) => (
                            <option key={type} value={type}>
                              {t.membership.type[type]}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="sm:col-span-1">
                        <span className="sr-only">{t.membership.memberNo}</span>
                        <input
                          name="member_no"
                          defaultValue={member.member_no ?? ""}
                          placeholder={t.membership.memberNo}
                          className="input py-1.5 text-[0.8125rem]"
                        />
                      </label>

                      <label className="sm:col-span-1">
                        <span className="sr-only">{t.membership.validUntil}</span>
                        <input
                          name="valid_until"
                          type="date"
                          defaultValue={member.valid_until ?? ""}
                          className="input py-1.5 text-[0.8125rem]"
                        />
                      </label>

                      <button
                        type="submit"
                        className="btn btn-secondary cursor-pointer px-3 py-1.5 text-[0.8125rem] sm:col-span-2"
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
          {mn ? "Гишүүн олдсонгүй." : "No members match these filters."}
        </p>
      )}
    </div>
  );
}
