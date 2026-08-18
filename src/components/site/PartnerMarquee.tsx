import Image from "next/image";
import type { Locale, Partner } from "@/lib/db/types";
import { tr } from "@/lib/db/types";
import { safeExternalLink } from "@/lib/video";

/**
 * The home page's partner strip.
 *
 * With a handful of partners a still grid reads best — four marks fill four columns and
 * there is nothing to scroll. Past that the row would wrap into a wall of logos, so it
 * becomes a slow marquee instead: one continuous line, drifting, paused under the
 * pointer. The switch happens at MARQUEE_FROM partners; below it this renders the grid.
 *
 * The moving version renders the list twice. The second copy is `aria-hidden` and its
 * links are taken out of the tab order, so a screen reader or keyboard meets each partner
 * once. All motion lives in CSS (`.marquee` in globals.css), which is also where reduced
 * motion turns it back into a still, wrapped row.
 */
const MARQUEE_FROM = 6;

function PartnerMark({ partner, locale, tabbable }: { partner: Partner; locale: Locale; tabbable: boolean }) {
  const href = safeExternalLink(partner.url);
  /*
    The mark sits in a fixed 3rem box, bottom-aligned, so marks of different heights
    stand on one shared line and every name beneath starts at the same height. A square
    seal and a wide wordmark then read as one row rather than a stagger.
  */
  const inner = (
    <>
      <span className="flex h-12 items-end">
        {partner.logo ? (
          <Image
            src={partner.logo}
            alt={partner.acronym || tr(partner, "name", locale)}
            width={240}
            height={96}
            sizes="160px"
            className="max-h-12 w-auto max-w-[10rem] object-contain object-left-bottom transition-transform duration-[240ms] ease-[var(--ease-out-quart)] group-hover:-translate-y-0.5"
          />
        ) : (
          <span className="block text-body font-semibold text-ink-900 transition-colors duration-100 group-hover:text-copper-700">
            {partner.acronym}
          </span>
        )}
      </span>
      <span className="mt-2 block max-w-[26ch] text-[0.8125rem] leading-snug text-ink-600 transition-colors duration-100 group-hover:text-ink-900">
        {tr(partner, "name", locale)}
      </span>
    </>
  );

  // A partner without a website is a label, not a link — nothing to point a cursor at.
  if (!href) return <div className="block">{inner}</div>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="group block"
      tabIndex={tabbable ? undefined : -1}
    >
      {inner}
    </a>
  );
}

export function PartnerMarquee({ partners, locale }: { partners: Partner[]; locale: Locale }) {
  if (partners.length < MARQUEE_FROM) {
    return (
      <ul className="mt-6 grid items-start gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
        {partners.map((partner) => (
          <li key={partner.id}>
            <PartnerMark partner={partner} locale={locale} tabbable />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="marquee mt-6" style={{ ["--marquee-items" as string]: partners.length }}>
      <div className="marquee-track">
        <ul className="marquee-copy">
          {partners.map((partner) => (
            <li key={partner.id} className="w-40 flex-none">
              <PartnerMark partner={partner} locale={locale} tabbable />
            </li>
          ))}
        </ul>
        <ul className="marquee-copy" aria-hidden="true">
          {partners.map((partner) => (
            <li key={partner.id} className="w-40 flex-none">
              <PartnerMark partner={partner} locale={locale} tabbable={false} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
