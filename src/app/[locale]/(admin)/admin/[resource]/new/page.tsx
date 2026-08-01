import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/lib/i18n/config";
import { bi, getResource } from "@/lib/admin/resources";
import { relationOptions } from "@/lib/admin/options";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { formLabels } from "@/components/admin/labels";

export default async function NewResourcePage({
  params,
}: {
  params: Promise<{ locale: string; resource: string }>;
}) {
  const { locale, resource: resourceKey } = await params;
  if (!isLocale(locale)) notFound();

  const resource = getResource(resourceKey);
  if (!resource || resource.fixed) notFound();

  const relations: Record<string, { value: string; label: string }[]> = {};
  for (const field of resource.fields) {
    if (field.optionsFrom) {
      relations[field.name] = await relationOptions(
        field.optionsFrom.table,
        field.optionsFrom.labelColumn,
      );
    }
  }

  // Sensible starting values so a new record is not born in an invalid state.
  const defaults: Record<string, unknown> = {
    status: "draft",
    version: "1.0",
    is_current: "1",
    sort: 0,
    year: new Date().getFullYear(),
  };

  return (
    <div>
      <Link
        href={localePath(locale, `/admin/${resource.key}`)}
        className="text-small text-ink-600 underline underline-offset-2 hover:text-copper-700"
      >
        ← {bi(resource.plural, locale)}
      </Link>

      <h1 className="mt-3 text-h2 font-bold">
        {locale === "mn" ? "Шинэ" : "New"} · {bi(resource.singular, locale)}
      </h1>

      <div className="mt-8">
        <ResourceForm
          resource={resource}
          locale={locale}
          values={defaults}
          relationOptions={relations}
          labels={formLabels(locale)}
        />
      </div>
    </div>
  );
}
