import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage, listBoardMembers } from "@/lib/queries";
import { formatDateNumeric } from "@/lib/format";
import { EmptyState, PageHeader, Prose } from "@/components/ui/Primitives";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).aboutNav.board };
}

export default async function BoardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const page = await getPage("about.board");
  const members = await listBoardMembers();
  const hasPhotos = members.some((member) => member.photo);

  return (
    <>
      <PageHeader title={tr(page, "title", locale) || t.aboutNav.board} />

      <div className="shell py-14 md:py-20">
        {tr(page, "body", locale) && <Prose body={tr(page, "body", locale)} className="mb-12" />}

        {members.length === 0 ? (
          <EmptyState title={t.about.boardEmpty} />
        ) : hasPhotos ? (
          /* Portraits only once MSID has supplied at least one. */
          <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member) => (
              <li key={member.id}>
                {/*
                  A portrait, not a poster. `w-full` at three columns made these 390px
                  wide and nearly 500 tall, which turned every member without a
                  photograph into a grey slab the size of the text beside it. Capped at
                  128px the photograph identifies a person and the words stay the point.
                */}
                {member.photo ? (
                  <Image
                    src={member.photo}
                    alt={tr(member, "name", locale)}
                    width={480}
                    height={600}
                    className="mb-4 aspect-4/5 w-32 rounded-lg object-cover"
                  />
                ) : (
                  <div
                    aria-hidden
                    className="mb-4 flex aspect-4/5 w-32 items-center justify-center rounded-lg bg-ink-100 text-xl font-semibold text-ink-500"
                  >
                    {tr(member, "name", locale).trim().charAt(0)}
                  </div>
                )}

                <p className="text-label font-semibold text-copper-700">
                  {tr(member, "role", locale)}
                </p>
                <h2 className="mt-1 text-[1.0625rem] font-semibold text-ink-900">
                  {member.degree && `${member.degree} `}
                  {tr(member, "name", locale)}
                </h2>
                {tr(member, "institution", locale) && (
                  <p className="mt-1 text-small text-ink-600">
                    {tr(member, "institution", locale)}
                  </p>
                )}
                {(member.term_from || member.term_to) && (
                  <p className="tabular mt-2 text-[0.8125rem] text-ink-600">
                    {t.about.term}: {formatDateNumeric(member.term_from) || "—"} –{" "}
                    {formatDateNumeric(member.term_to) || "…"}
                  </p>
                )}
                {tr(member, "bio", locale) && (
                  <p className="mt-3 text-small text-ink-700">
                    {tr(member, "bio", locale)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          /*
            No photographs yet. A grid of empty grey rectangles reads as broken, so the
            board falls back to a roster in the site's register form — role, name,
            institution — which stands on its own and needs no imagery.
          */
          <ul className="register">
            {members.map((member) => (
              <li key={member.id} className="register-row md:grid-cols-[14rem_minmax(0,1fr)_auto]">
                <p className="text-label font-semibold text-copper-700">
                  {tr(member, "role", locale)}
                </p>

                <div className="min-w-0">
                  <h2 className="text-[1.0625rem] font-semibold text-ink-900">
                    {member.degree && `${member.degree} `}
                    {tr(member, "name", locale)}
                  </h2>
                  {tr(member, "institution", locale) && (
                    <p className="mt-1 text-small text-ink-600">
                      {tr(member, "institution", locale)}
                    </p>
                  )}
                  {tr(member, "bio", locale) && (
                    <p className="mt-2 max-w-[62ch] text-small text-ink-700">
                      {tr(member, "bio", locale)}
                    </p>
                  )}
                </div>

                {(member.term_from || member.term_to) && (
                  <p className="tabular text-[0.8125rem] text-ink-600 md:text-right">
                    {formatDateNumeric(member.term_from) || "—"} –{" "}
                    {formatDateNumeric(member.term_to) || "…"}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
