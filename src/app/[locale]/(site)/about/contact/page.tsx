import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { tr } from "@/lib/db/types";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getPage } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { Prose } from "@/components/ui/Primitives";
import { SectionHeader } from "@/components/site/SectionHeader";
import { safeExternalLink } from "@/lib/video";

/*
  The Society's seat: the First Central Hospital of Mongolia, Ulaanbaatar.
  A tight box around the point, and the point itself as the marker.
*/
const MAP_LAT = 47.9165294;
const MAP_LON = 106.9244636;
/* Rounded, or binary floating point puts `47.918529400000004` in the URL. */
const box = (n: number) => n.toFixed(6);
const MAP_EMBED =
  `https://www.openstreetmap.org/export/embed.html` +
  `?bbox=${box(MAP_LON - 0.003)}%2C${box(MAP_LAT - 0.002)}` +
  `%2C${box(MAP_LON + 0.003)}%2C${box(MAP_LAT + 0.002)}` +
  `&layer=mapnik&marker=${MAP_LAT}%2C${MAP_LON}`;
const MAP_LINK = `https://www.openstreetmap.org/?mlat=${MAP_LAT}&mlon=${MAP_LON}#map=17/${MAP_LAT}/${MAP_LON}`;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getDictionary(locale).aboutNav.contact };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const t = getDictionary(locale);
  const page = await getPage("about.contact");
  const settings = await getSettings();

  const address =
    locale === "mn" ? settings.contact_address_mn : settings.contact_address_en;
  const hours = locale === "mn" ? settings.contact_hours_mn : settings.contact_hours_en;

  const rows = [
    { label: t.about.address, value: address },
    {
      label: t.about.phone,
      value: settings.contact_phone,
      href: `tel:${settings.contact_phone.replace(/\s/g, "")}`,
    },
    {
      label: t.about.email,
      value: settings.contact_email,
      href: `mailto:${settings.contact_email}`,
    },
    { label: t.about.hours, value: hours },
  ].filter((row) => row.value);

  return (
    <>
      <SectionHeader banner={page?.banner} title={tr(page, "title", locale) || t.about.contactTitle} />

      <div className="shell py-12 md:py-16">
        {tr(page, "body", locale) && (
          <Prose body={tr(page, "body", locale)} className="mb-10" />
        )}

        <dl className="register max-w-2xl">
          {rows.map((row) => (
            <div key={row.label} className="register-row md:grid-cols-[9rem_minmax(0,1fr)]">
              <dt className="text-label font-semibold text-ink-600">{row.label}</dt>
              <dd className="text-ink-900">
                {row.label === t.about.address ? (
                  /*
                    The Society's rooms are inside the First Central Hospital, so the
                    hospital's mark sits with the address — it is how a visitor will
                    recognise the building when they arrive. The horizontal lockup, under
                    the address rather than beside it: it names the hospital in full,
                    which the circular mark alone does not at this size. Decorative,
                    because the address above already says where this is.
                  */
                  <>
                    {row.value}
                    <Image
                      src="/brand/unte-logo.png"
                      alt=""
                      width={2956}
                      height={1365}
                      sizes="300px"
                      className="mt-3 -ml-3 h-auto w-[17rem] max-w-full"
                    />
                  </>
                ) : row.href ? (
                  <a
                    href={row.href}
                    className="text-copper-700 underline decoration-1 underline-offset-2 hover:text-copper-800"
                  >
                    {row.value}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>

        {/*
          The map.

          OpenStreetMap rather than Google: it needs no API key, and it does not report
          every visitor to this page to an advertising company — which matters on a
          medical society's site, where the visit itself can be sensitive. The
          coordinates are the Society's seat at the First Central Hospital of Mongolia,
          supplied by Chinguun (August 2026); `contact_map_url` still overrides them, so
          an administrator can swap in a different embed without touching code.

          `loading="lazy"` matters more than usual here: an embedded map is the heaviest
          thing on this page, and this site is read on hospital wifi.
        */}
        <div className="mt-10 max-w-3xl">
          <iframe
            src={settings.contact_map_url || MAP_EMBED}
            title={t.about.address}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="aspect-[16/9] w-full rounded-lg border border-ink-200"
          />
          <p className="mt-2 text-[0.8125rem]">
            <a
              href={MAP_LINK}
              target="_blank"
              rel="noreferrer noopener"
              className="text-copper-700 underline decoration-1 underline-offset-2 hover:text-copper-800"
            >
              {locale === "mn" ? "Том газрын зураг дээр харах" : "View a larger map"}
            </a>
          </p>
        </div>

        {settings.facebook_url && (
          <p className="mt-8">
            <a
              href={safeExternalLink(settings.facebook_url) ?? "#"}
              target="_blank"
              rel="noreferrer noopener"
              className="btn btn-secondary"
            >
              {/* The mark itself, so the row reads as Facebook before it is read at all. */}
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden>
                <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.24 10.44 22v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.91h-2.33V22C18.34 21.24 22 17.08 22 12.06z" />
              </svg>
              Facebook
            </a>
          </p>
        )}
      </div>
    </>
  );
}
