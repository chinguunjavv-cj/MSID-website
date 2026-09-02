import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale, localePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage } from "@/lib/queries";
import { ProseList } from "@/components/ui/Primitives";
import { SectionHeader } from "@/components/site/SectionHeader";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).membership.title };
}

export default async function MembershipPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const intro = await getPage("membership.intro");
  const benefits = await getPage("membership.benefits");
  const benefitsBody = tr(benefits, "body", locale);

  const types: (keyof typeof t.membership.type)[] = [
    "full",
    "associate",
    "trainee",
    "honorary",
  ];

  return (
    <>
      <SectionHeader
        banner={intro?.banner}
        title={tr(intro, "title", locale) || t.membership.title}
        lead={tr(intro, "body", locale) || t.membership.lead}
      />

      {/*
        The page reads as one decision, top to bottom: what membership gives you, which
        category you fall into, then how to apply. The three steps deliberately sit on
        three different grounds — paper, ink-50, copper — so the eye can tell them apart
        without a single decorative mark. Two equal columns of hairline rows was the old
        shape, and it gave a persuasive list and a definitional register the same weight.
      */}

      {/* ---------------------------------------------------------------- */}
      {/* What membership gives you                                         */}
      {/* ---------------------------------------------------------------- */}
      {/* A heading with nothing under it reads as a broken page, not an empty one. */}
      {benefitsBody && (
        <section className="shell py-14 md:py-20">
          <h2 className="max-w-[20ch] text-h2 font-bold text-balance">
            {t.membership.benefits}
          </h2>
          <div className="max-w-[64ch]">
            <ProseList body={benefitsBody} />
          </div>
        </section>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Which category you fall into                                      */}
      {/* ---------------------------------------------------------------- */}
      {/*
        The register is the signature component and this is what it is for: four defined
        terms, aligned on one column, read down rather than across. On a tinted ground so
        it separates from the benefits above without needing a card.
      */}
      <section className="bg-ink-50">
        <div className="shell py-14 md:py-20">
          <h2 className="max-w-[20ch] text-h2 font-bold text-balance">
            {t.membership.types}
          </h2>

          <dl className="register mt-8">
            {types.map((type) => (
              <div
                key={type}
                className="register-row md:grid-cols-[minmax(11rem,15rem)_minmax(0,1fr)]"
              >
                <dt className="font-semibold text-ink-900">
                  {t.membership.type[type]}
                </dt>
                <dd className="max-w-[56ch] text-ink-700 text-pretty">
                  {t.membership.typeWho[type]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* Apply                                                             */}
      {/* ---------------------------------------------------------------- */}
      {/*
        The one primary action on the page, given a drenched ground of its own rather
        than a lone button under a rule.

        No supporting sentence here on purpose: what happens after you apply is already
        stated in the admin-authored intro at the top. Restating it beside the button put
        two near-identical Mongolian sentences on one screen.
      */}
      {/*
        The tint marks the ask; it does not drench it. This was `on-copper` — a
        copper-700 ground, the solid brown Chinguun rejected — and it was the last
        drenched surface on the public site. Same treatment as the homepage's membership
        band now, so the two places that ask the same question look like each other.
      */}
      <section className="border-y border-ink-200 bg-ink-50">
        <div className="shell py-14 md:py-20">
          <div className="flex flex-wrap items-center justify-between gap-x-12 gap-y-8">
            <h2 className="max-w-[20ch] text-h2 font-semibold text-balance">
              {t.membership.applyTitle}
            </h2>

            <div className="shrink-0 md:text-right">
              <Link
                href={localePath(locale, "/membership/apply")}
                className="btn btn-primary"
              >
                {t.membership.apply}
              </Link>
              <p className="mt-4 text-small text-ink-700">
                {t.auth.hasAccount}{" "}
                <Link
                  href={localePath(locale, "/login")}
                  className="font-semibold text-copper-700 underline underline-offset-2"
                >
                  {t.auth.login}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
