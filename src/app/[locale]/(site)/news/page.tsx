import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { listPublishedNews } from "@/lib/queries";
import { EmptyState } from "@/components/ui/Primitives";
import { SectionHeader } from "@/components/site/SectionHeader";
import { NewsRow } from "@/components/site/records";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).events.news };
}

export default async function NewsIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const posts = await listPublishedNews(50);

  return (
    <>
      <SectionHeader
        title={t.events.news}
        breadcrumb={[{ label: t.events.title, href: localePath(locale, "/events") }]}
      />

      <div className="shell py-14 md:py-20">
        {posts.length > 0 ? (
          <div className="register">
            {posts.map((post) => (
              <NewsRow key={post.id} post={post} locale={locale} />
            ))}
          </div>
        ) : (
          <EmptyState title={t.events.noNews} />
        )}
      </div>
    </>
  );
}
