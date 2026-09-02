import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage, listBoardMembers } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { formatDate, toParagraphs } from "@/lib/format";
import { Prose } from "@/components/ui/Primitives";
import { SectionHeader } from "@/components/site/SectionHeader";

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
  */
  const president = (await listBoardMembers())[0];

  /*
    A letter is signed at the foot, so the portrait belongs beside the signature rather
    than above the opening line. Both language bodies end with the same three-line block
    — name, then office and degree, then honours — so the last paragraph is the sign-off
    and is lifted out of the prose to sit next to the photograph.

    If an administrator ever adds a paragraph *after* the signature, it would be treated
    as the sign-off. That is the cost of inferring structure from a plain-text body; the
    alternative is separate signature fields, which is worth doing if this page ever
    stops being one letter from one person.
  */
  const blocks = toParagraphs(tr(page, "body", locale));
  const signOff = blocks.length > 1 ? blocks.at(-1)! : "";
  const letter = signOff ? blocks.slice(0, -1).join("\n\n") : blocks.join("\n\n");

  return (
    <>
      <SectionHeader
        banner={page?.banner}
        title={tr(page, "title", locale) || t.aboutNav.welcome}
        meta={
          <p className="text-small text-ink-600">
            {t.about.founded}{" "}
            <time dateTime={settings.founded_on} className="tabular text-ink-700">
              {formatDate(settings.founded_on, locale)}
            </time>
          </p>
        }
      />

      <div className="shell py-12 md:py-16">
        <Prose body={letter} />

        {/*
          The width cap belongs on the letter, not on the signature. `measure` (68ch) on
          this row was being shared with the portrait, so the honours line — "Монгол
          Улсын төрийн соёрхолт, Хүний гавьяат эмч" — broke after "Хүний" and the
          three-line block rendered as four. The block is short and its line breaks are
          authored; it needs room to keep them.
        */}
        {signOff && (
          <div className="mt-10 flex max-w-3xl items-center gap-6">
            {president?.photo && (
              <Image
                src={president.photo}
                alt={`${tr(president, "name", locale)}, ${tr(president, "role", locale)}`}
                width={480}
                height={600}
                className="aspect-4/5 w-24 shrink-0 object-cover sm:w-28"
              />
            )}
            <p className="reading min-w-0 whitespace-pre-line text-ink-800">{signOff}</p>
          </div>
        )}
      </div>
    </>
  );
}
