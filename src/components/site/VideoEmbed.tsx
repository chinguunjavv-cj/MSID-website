import type { Locale } from "@/lib/db/types";
import { parseVideoUrl, safeExternalLink } from "@/lib/video";

/**
 * Renders an administrator-supplied video link.
 *
 * A recognised provider is framed; anything else becomes a plain link. `sandbox` is set
 * so a framed player cannot navigate the page it sits in, and `referrerPolicy` stops the
 * provider learning which guideline or event page the visitor was reading.
 */
export function VideoEmbed({
  url,
  locale,
  label,
}: {
  url: string;
  locale: Locale;
  label?: string;
}) {
  const video = parseVideoUrl(url);
  const mn = locale === "mn";
  const heading = label ?? (mn ? "Бичлэг" : "Recording");

  if (!video) {
    const link = safeExternalLink(url);
    if (!link) return null;
    return (
      <section className="mt-12">
        <h2 className="text-h3 font-bold">{heading}</h2>
        <a
          href={link}
          target="_blank"
          rel="noreferrer noopener"
          className="btn btn-secondary mt-4"
        >
          {mn ? "Бичлэгийг үзэх" : "Watch the recording"} ↗
        </a>
      </section>
    );
  }

  return (
    <section className="mt-12">
      <h2 className="text-h3 font-bold">{heading}</h2>
      <div className="mt-4 aspect-video w-full overflow-hidden border border-ink-200 bg-ink-950">
        <iframe
          src={video.embedUrl}
          title={heading}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
          className="h-full w-full"
        />
      </div>
      <a
        href={video.sourceUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="btn btn-ghost mt-3"
      >
        {video.title} ↗
      </a>
    </section>
  );
}
