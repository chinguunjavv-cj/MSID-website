import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage } from "@/lib/queries";
import { PageHeader, Prose } from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).aboutNav.mission };
}

export default async function MissionPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const page = await getPage("about.mission");

  return (
    <>
      <PageHeader title={tr(page, "title", locale) || t.aboutNav.mission} />
      <div className="shell py-14 md:py-20">
        <Prose body={tr(page, "body", locale)} />

        {/*
          The photograph sits under the text and a little wider than it. Prose is capped
          at 68ch for reading; a picture held to that measure reads as an illustration
          dropped into a column, while letting it run to 48rem makes it the page's
          closing statement — which is what a photograph of the Society at work is on a
          page about what the Society is for.
        */}
        {page?.image && (
          <figure className="mt-12 max-w-3xl">
            <Image
              src={page.image}
              alt={tr(page, "image_alt", locale)}
              width={2200}
              height={1650}
              sizes="(min-width: 48rem) 48rem, 100vw"
              className="w-full rounded-lg"
            />
            {tr(page, "image_alt", locale) && (
              <figcaption className="mt-3 text-small text-ink-600 text-pretty">
                {tr(page, "image_alt", locale)}
              </figcaption>
            )}
          </figure>
        )}
      </div>
    </>
  );
}
