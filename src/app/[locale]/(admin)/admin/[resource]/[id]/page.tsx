import Link from "next/link";
import { notFound } from "next/navigation";
import { get } from "@/lib/db";
import { tr } from "@/lib/db/types";
import { requireStaffPage } from "@/lib/auth/session";
import { isLocale, localePath } from "@/lib/i18n/config";
import { bi, getResource } from "@/lib/admin/resources";
import { relationOptions } from "@/lib/admin/options";
import { deletionBlockedReason } from "@/lib/admin/deletion";
import { listEventFees, listEventOrganisers, listEventSessions } from "@/lib/queries";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { EventFees, EventOrganisers, EventProgramme } from "@/components/admin/EventExtras";
import { formLabels } from "@/components/admin/labels";

export default async function EditResourcePage({
  params,
}: {
  params: Promise<{ locale: string; resource: string; id: string }>;
}) {
  const { locale, resource: resourceKey, id: rawId } = await params;
  if (!isLocale(locale)) notFound();
  await requireStaffPage(locale);

  const resource = getResource(resourceKey);
  if (!resource) notFound();

  const id = decodeURIComponent(rawId);
  const idColumn = resource.idColumn ?? "id";

  const record = await get<Record<string, unknown>>(
    `SELECT * FROM ${resource.table} WHERE ${idColumn} = ?`,
    id,
  );
  if (!record) notFound();

  const relations: Record<string, { value: string; label: string }[]> = {};
  for (const field of resource.fields) {
    if (field.optionsFrom) {
      relations[field.name] = await relationOptions(
        field.optionsFrom.table,
        field.optionsFrom.labelColumn,
        field.optionsFrom.excludeSelf ? id : undefined,
      );
    }
  }

  const labels = formLabels(locale);
  const title = tr(record, resource.listPrimary, locale) || id;
  const slug = typeof record.slug === "string" ? record.slug : "";

  const publicPath: Record<string, string> = {
    events: "/events",
    guidelines: "/guidelines",
    publications: "/publications",
    news: "/news",
  };

  return (
    <div>
      <Link
        href={localePath(locale, `/admin/${resource.key}`)}
        className="text-small text-ink-600 underline underline-offset-2 hover:text-copper-700"
      >
        ← {bi(resource.plural, locale)}
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h2 font-bold">{title}</h1>
        {slug && publicPath[resource.key] && (
          <Link
            href={localePath(locale, `${publicPath[resource.key]}/${slug}`)}
            target="_blank"
            className="btn btn-secondary"
          >
            {locale === "mn" ? "Сайт дээр харах" : "View on site"} ↗
          </Link>
        )}
      </div>

      <div className="mt-8">
        <ResourceForm
          resource={resource}
          locale={locale}
          values={record}
          recordId={id}
          relationOptions={relations}
          labels={labels}
          deleteBlockedReason={await deletionBlockedReason(resource.key, id, locale)}
        />
      </div>

      {resource.key === "events" && (
        <>
          <EventFees
            eventId={id}
            fees={await listEventFees(id)}
            locale={locale}
            labels={labels}
          />
          <EventOrganisers
            eventId={id}
            organisers={await listEventOrganisers(id)}
            locale={locale}
            labels={labels}
          />
          <EventProgramme
            eventId={id}
            sessions={await listEventSessions(id)}
            locale={locale}
            labels={labels}
          />
        </>
      )}
    </div>
  );
}
