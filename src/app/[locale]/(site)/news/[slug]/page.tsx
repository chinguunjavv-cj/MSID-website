import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { hasTranslation, tr } from "@/lib/db/types";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getNewsBySlug } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { PageHeader, Prose, TranslationNotice } from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const post = getNewsBySlug(slug);
  if (!post) return {};
  return {
    title: tr(post, "title", locale),
    description: tr(post, "excerpt", locale) || undefined,
  };
}

export default async function NewsPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();

  const post = getNewsBySlug(slug);
  if (!post) notFound();

  const t = getDictionary(locale);
  const published = post.published_at ?? post.created_at;

  return (
    <>
      <PageHeader
        title={tr(post, "title", locale)}
        lead={tr(post, "excerpt", locale) || undefined}
        breadcrumb={[{ label: t.events.news, href: localePath(locale, "/news") }]}
        meta={
          <time dateTime={published} className="tabular text-small text-ink-300">
            {formatDate(published, locale)}
          </time>
        }
      />

      {post.cover_image && (
        <div className="shell pt-10">
          <Image
            src={post.cover_image}
            alt={tr(post, "cover_alt", locale)}
            width={1600}
            height={900}
            className="aspect-video w-full object-cover"
            priority
          />
        </div>
      )}

      <div className="shell py-14 md:py-20">
        {!hasTranslation(post, "body", locale) && tr(post, "body", locale) && (
          <TranslationNotice locale={locale} />
        )}
        <Prose body={tr(post, "body", locale)} />
      </div>
    </>
  );
}
