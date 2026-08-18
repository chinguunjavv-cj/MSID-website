import Link from "next/link";
import { notFound } from "next/navigation";
import { all } from "@/lib/db";
import { tr, type Locale } from "@/lib/db/types";
import { requireStaffPage } from "@/lib/auth/session";
import { isLocale, localePath } from "@/lib/i18n/config";
import { RESOURCES, bi, getResource } from "@/lib/admin/resources";
import { formatDateNumeric } from "@/lib/format";
import { StatusPill, type PillTone } from "@/components/ui/Primitives";

export function generateStaticParams() {
  return Object.keys(RESOURCES).map((resource) => ({ resource }));
}

function statusTone(status: string): PillTone {
  if (status === "published") return "active";
  if (status === "draft" || status === "review") return "pending";
  if (status === "archived" || status === "superseded") return "expired";
  return "neutral";
}

function statusLabel(resourceKey: string, status: string, locale: Locale): string {
  const definition = getResource(resourceKey);
  const field = definition?.fields.find((entry) => entry.name === "status");
  const option = field?.options?.find((entry) => entry.value === status);
  return option ? bi(option.label, locale) : status;
}

export default async function ResourceListPage({
  params,
}: {
  params: Promise<{ locale: string; resource: string }>;
}) {
  const { locale, resource: resourceKey } = await params;
  if (!isLocale(locale)) notFound();
  await requireStaffPage(locale);

  const resource = getResource(resourceKey);
  if (!resource) notFound();

  const mn = locale === "mn";
  const idColumn = resource.idColumn ?? "id";

  const rows = await all<Record<string, unknown>>(
    `SELECT * FROM ${resource.table} ORDER BY ${resource.defaultOrder}`,
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2 font-bold">{bi(resource.plural, locale)}</h1>
        {!resource.fixed && (
          <Link
            href={localePath(locale, `/admin/${resource.key}/new`)}
            className="btn btn-primary"
          >
            + {bi(resource.singular, locale)}
          </Link>
        )}
      </div>

      {rows.length > 0 ? (
        <div className="table-scroll mt-8">
          <table className="data-table">
            <caption className="sr-only">{bi(resource.plural, locale)}</caption>
            <thead>
              <tr>
                <th scope="col">{mn ? "Нэр" : "Name"}</th>
                {resource.listDate && <th scope="col">{mn ? "Огноо" : "Date"}</th>}
                {resource.listStatus && <th scope="col">{mn ? "Төлөв" : "Status"}</th>}
                <th scope="col">
                  <span className="sr-only">{mn ? "Үйлдэл" : "Actions"}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const id = String(row[idColumn]);
                const primary =
                  tr(row, resource.listPrimary, locale) ||
                  String(row[resource.listPrimary] ?? id);

                return (
                  <tr key={id}>
                    <td>
                      <Link
                        href={localePath(
                          locale,
                          `/admin/${resource.key}/${encodeURIComponent(id)}`,
                        )}
                        className="font-semibold text-copper-700 underline underline-offset-2"
                      >
                        {primary || (mn ? "(нэргүй)" : "(untitled)")}
                      </Link>
                      {resource.fixed && (
                        <span className="mt-0.5 block text-[0.75rem] text-ink-600">
                          {id}
                        </span>
                      )}
                      {/* A record with no Mongolian text renders as untranslated to
                          most visitors, so it is flagged here rather than in the page. */}
                      {row[`${resource.listPrimary}_mn`] === "" &&
                        row[`${resource.listPrimary}_en`] !== "" && (
                          <span className="pill pill-pending mt-1.5 inline-flex">
                            {mn ? "Монгол орчуулга дутуу" : "Mongolian missing"}
                          </span>
                        )}
                    </td>

                    {resource.listDate && (
                      <td className="tabular whitespace-nowrap">
                        {formatDateNumeric(
                          String(row[resource.listDate] ?? "").slice(0, 10),
                        ) || "—"}
                      </td>
                    )}

                    {resource.listStatus && (
                      <td>
                        <StatusPill
                          label={statusLabel(resource.key, String(row.status ?? ""), locale)}
                          tone={statusTone(String(row.status ?? ""))}
                        />
                      </td>
                    )}

                    <td className="text-right">
                      <Link
                        href={localePath(
                          locale,
                          `/admin/${resource.key}/${encodeURIComponent(id)}`,
                        )}
                        className="text-small font-medium text-ink-700 underline underline-offset-2 hover:text-copper-700"
                      >
                        {mn ? "Засах" : "Edit"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-8 border-t border-ink-200 py-14">
          <p className="font-semibold text-ink-800">
            {mn ? "Контент алга." : "Nothing here yet."}
          </p>
          {!resource.fixed && (
            <Link
              href={localePath(locale, `/admin/${resource.key}/new`)}
              className="btn btn-primary mt-5"
            >
              + {bi(resource.singular, locale)}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
