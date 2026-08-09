/**
 * Shown while a site page fetches its data.
 *
 * Without this, clicking a link did nothing at all until the server had finished
 * querying — the old page just sat there, and on a phone in Mongolia reaching a
 * database in another region that pause is long enough to read as a broken link and
 * be clicked again.
 *
 * The shape mirrors what actually arrives: the dark header band with a title and lead,
 * then body lines. Matching the real layout means the page settles into place rather
 * than jumping when the content lands.
 */
export default function SiteLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Уншиж байна…</span>

      {/* Matches PageHeader: paper over a hairline, not the ink band it used to be —
          otherwise a black slab flashes and turns white as the page lands. */}
      <div className="border-b border-ink-200">
        <div className="shell pt-10 pb-8 md:pt-14 md:pb-10">
          <div className="skeleton h-3 w-28" />
          <div className="skeleton mt-5 h-8 w-[min(24rem,80%)] md:h-9" />
          <div className="skeleton mt-4 h-4 w-[min(34rem,92%)]" />
        </div>
      </div>

      <div className="shell py-14 md:py-20">
        <div className="measure flex flex-col gap-3">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-[94%]" />
          <div className="skeleton h-4 w-[97%]" />
          <div className="skeleton h-4 w-[62%]" />
        </div>
      </div>
    </div>
  );
}
