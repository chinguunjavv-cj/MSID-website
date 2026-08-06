import Image from "next/image";
import type { Locale } from "@/lib/db/types";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/format";
import { safeExternalLink } from "@/lib/video";

export async function Footer({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const settings = await getSettings();
  const year = new Date().getFullYear();

  const address =
    locale === "mn" ? settings.contact_address_mn : settings.contact_address_en;

  return (
    <footer className="on-dark mt-24 border-t-2 border-copper-600">
      {/*
        Two columns: who we are, how to reach us. No quick links — the masthead is
        sticky and already carries the navigation — and no partners, because the pages
        that owe the partners a mention (the homepage, Хамтын ажиллагаа) name them in
        full, with their long names, right above this. A footer that repeats the page
        is longer, not more useful.
      */}
      <div className="shell grid gap-12 py-14 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-16 md:py-16">
        <div>
          <div className="flex items-center gap-3">
            {/* The mark is a copper logo on white; a paper tile keeps it legible on ink. */}
            <span className="inline-flex h-12 w-12 items-center justify-center bg-paper p-1">
              <Image
                src="/brand/msid-logo.jpg"
                alt=""
                width={320}
                height={320}
                className="h-full w-full object-contain"
              />
            </span>
            <span className="text-2xl font-extrabold tracking-[-0.03em] text-paper">
              MSID
            </span>
          </div>

          <p className="mt-5 max-w-[38ch] text-small text-ink-300">{t.org.name}</p>
          <p className="mt-3 text-small text-ink-400">
            {t.footer.ngo} · {t.about.founded}{" "}
            <time dateTime={settings.founded_on}>
              {formatDate(settings.founded_on, locale)}
            </time>
          </p>
        </div>

        <div>
          <h2 className="text-label font-semibold text-paper">{t.footer.contact}</h2>
          <address className="mt-4 space-y-3 text-small text-ink-300 not-italic">
            <p className="max-w-[34ch]">{address}</p>
            <p>
              <a
                href={`tel:${settings.contact_phone.replace(/\s/g, "")}`}
                className="transition-colors duration-100 hover:text-paper"
              >
                {settings.contact_phone}
              </a>
            </p>
            <p>
              <a
                href={`mailto:${settings.contact_email}`}
                className="transition-colors duration-100 hover:text-paper"
              >
                {settings.contact_email}
              </a>
            </p>
          </address>
          {settings.facebook_url && (
            <a
              href={safeExternalLink(settings.facebook_url) ?? "#"}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-4 inline-block text-small font-medium text-copper-400 transition-colors duration-100 hover:text-copper-300"
            >
              Facebook →
            </a>
          )}
        </div>

      </div>

      <div className="border-t border-white/10">
        <div className="shell flex flex-col gap-2 py-5 text-[0.8125rem] text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {t.org.name}. {t.footer.rights}
          </p>
          <p className="tabular">
            {settings.contact_email} · {settings.contact_phone}
          </p>
        </div>
      </div>
    </footer>
  );
}
