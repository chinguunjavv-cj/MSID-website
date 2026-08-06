import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage, listBoardMembers } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/format";
import { PageHeader, Prose } from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).aboutNav.welcome };
}

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const page = await getPage("about.welcome");
  const settings = await getSettings();

  /*
    The greeting is the President's, and the board list is ordered with the President
    first, so its opening entry is who signs this letter. Shown only when a photograph
    has actually been supplied — a grey placeholder rectangle reads as broken rather
    than as pending, the same reason the board grid holds its portraits back.

    Deliberately uncaptioned: the letter is signed at the foot, and repeating the name
    under the portrait would state it twice on one page.
  */
  const president = (await listBoardMembers())[0];

  return (
    <>
      <PageHeader
        title={tr(page, "title", locale) || t.aboutNav.welcome}
        meta={
          <p className="text-small text-ink-400">
            {t.about.founded}{" "}
            <time dateTime={settings.founded_on} className="tabular text-ink-200">
              {formatDate(settings.founded_on, locale)}
            </time>
          </p>
        }
      />

      <div className="shell py-14 md:py-20">
        {president?.photo && (
          <Image
            src={president.photo}
            alt={`${tr(president, "name", locale)}, ${tr(president, "role", locale)}`}
            width={480}
            height={600}
            priority
            className="mb-10 aspect-4/5 w-44 object-cover md:w-52"
          />
        )}

        <Prose body={tr(page, "body", locale)} />
      </div>
    </>
  );
}
