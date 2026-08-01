import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasTranslation, tr } from "@/lib/db/types";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { findSuccessor, getGuidelineById, getGuidelineBySlug } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import {
  PageHeader,
  Prose,
  StatusPill,
  TranslationNotice,
  guidelineTone,
} from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const guideline = await getGuidelineBySlug(slug);
  if (!guideline) return {};
  return {
    title: tr(guideline, "title", locale),
    description: tr(guideline, "summary", locale) || undefined,
  };
}

export default async function GuidelinePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const guideline = await getGuidelineBySlug(slug);
  if (!guideline) notFound();

  const t = getDictionary(locale);
  const status = guideline.status as keyof typeof t.guidelines.status;
  const successor = await findSuccessor(guideline.id);
  const predecessor = guideline.supersedes_id
    ? await getGuidelineById(guideline.supersedes_id)
    : undefined;

  const facts = [
    { label: t.guidelines.code, value: guideline.code },
    { label: t.guidelines.version, value: guideline.version },
    { label: t.guidelines.category, value: tr(guideline, "category", locale) },
    { label: t.guidelines.approved, value: formatDate(guideline.approved_on, locale) },
    { label: t.guidelines.effective, value: formatDate(guideline.effective_from, locale) },
    { label: t.guidelines.reviewDue, value: formatDate(guideline.review_due, locale) },
  ].filter((fact) => fact.value);

  return (
    <>
      <PageHeader
        title={tr(guideline, "title", locale)}
        lead={tr(guideline, "summary", locale) || undefined}
        breadcrumb={[{ label: t.guidelines.title, href: localePath(locale, "/guidelines") }]}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <StatusPill
              label={t.guidelines.status[status] ?? guideline.status}
              tone={guidelineTone(guideline.status)}
            />
            {guideline.code && (
              <span className="tabular text-small text-ink-300">
                {guideline.code} · v{guideline.version}
              </span>
            )}
          </div>
        }
      />

      <div className="shell py-14 md:py-20">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-16">
          <div>
            {!hasTranslation(guideline, "body", locale) &&
              tr(guideline, "body", locale) && <TranslationNotice locale={locale} />}

            {successor && (
              <p className="mb-8 border border-status-pending/30 bg-status-pending-bg px-4 py-3 text-small">
                {t.guidelines.supersededBy}{" "}
                <Link
                  href={localePath(locale, `/guidelines/${successor.slug}`)}
                  className="font-semibold underline underline-offset-2"
                >
                  {tr(successor, "title", locale)}
                </Link>
              </p>
            )}

            <Prose body={tr(guideline, "body", locale)} />

            {predecessor && (
              <p className="mt-10 text-small text-ink-600">
                {t.guidelines.supersedes}{" "}
                <Link
                  href={localePath(locale, `/guidelines/${predecessor.slug}`)}
                  className="text-copper-700 underline underline-offset-2"
                >
                  {tr(predecessor, "title", locale)}
                </Link>
              </p>
            )}
          </div>

          <aside className="lg:sticky lg:top-32 lg:self-start">
            {guideline.file_path && (
              <a
                href={guideline.file_path}
                download
                className="btn btn-primary mb-8 w-full"
              >
                {t.guidelines.downloadPdf}
                {guideline.file_size > 0 && (
                  <span className="tabular font-normal opacity-80">
                    {(guideline.file_size / 1_048_576).toFixed(1)} MB
                  </span>
                )}
              </a>
            )}

            <dl className="border-t-2 border-ink-900">
              {facts.map((fact) => (
                <div key={fact.label} className="border-b border-ink-200 py-3">
                  <dt className="text-label font-semibold text-ink-600">{fact.label}</dt>
                  <dd className="tabular mt-1 font-semibold text-ink-900">
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </>
  );
}
