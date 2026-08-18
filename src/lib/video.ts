/**
 * Turns an administrator-supplied video link into a safe embed.
 *
 * The URL an administrator pastes is **never** placed in an `iframe src`. Each provider
 * is matched with a strict pattern, the video id is extracted, and the embed URL is
 * rebuilt from a fixed template. A link to somewhere unrecognised is rendered as an
 * ordinary link rather than framed, so pasting a hostile URL can at worst produce a
 * hyperlink the visitor has to choose to follow.
 *
 * Video is linked, not uploaded: congress recordings run to gigabytes, which would be
 * slow and expensive in blob storage, and MSID already publishes to Facebook and
 * YouTube.
 */

export interface VideoEmbed {
  provider: "youtube" | "vimeo" | "facebook";
  /** Built from a fixed template plus an extracted id — never the raw input. */
  embedUrl: string;
  /** The original link, for the "watch on …" fallback. */
  sourceUrl: string;
  title: string;
}

const YOUTUBE_ID = /^[\w-]{11}$/;
const NUMERIC_ID = /^\d{6,12}$/;

export function parseVideoUrl(input: string): VideoEmbed | null {
  const raw = input?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  // Only https. An http embed would be blocked as mixed content anyway.
  if (url.protocol !== "https:") return null;

  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  /* ---- YouTube ---------------------------------------------------------- */
  if (host === "youtube.com" || host === "m.youtube.com") {
    const id =
      url.searchParams.get("v") ??
      (url.pathname.startsWith("/embed/") ? url.pathname.slice(7) : null) ??
      (url.pathname.startsWith("/live/") ? url.pathname.slice(6) : null);
    if (id && YOUTUBE_ID.test(id)) {
      // `-nocookie` so a visitor reading a guideline is not tracked for it.
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
        sourceUrl: `https://www.youtube.com/watch?v=${id}`,
        title: "YouTube",
      };
    }
  }
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    if (YOUTUBE_ID.test(id)) {
      return {
        provider: "youtube",
        embedUrl: `https://www.youtube-nocookie.com/embed/${id}`,
        sourceUrl: `https://www.youtube.com/watch?v=${id}`,
        title: "YouTube",
      };
    }
  }

  /* ---- Vimeo ------------------------------------------------------------ */
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean).pop() ?? "";
    if (NUMERIC_ID.test(id)) {
      return {
        provider: "vimeo",
        embedUrl: `https://player.vimeo.com/video/${id}`,
        sourceUrl: `https://vimeo.com/${id}`,
        title: "Vimeo",
      };
    }
  }

  /* ---- Facebook --------------------------------------------------------- */
  if (host === "facebook.com" || host === "fb.watch" || host === "web.facebook.com") {
    /*
      Facebook's plugin takes the whole post URL as a parameter rather than an id. The
      value is URL-encoded and the host is already known to be Facebook's, so nothing
      attacker-controlled reaches the iframe's own origin.
    */
    return {
      provider: "facebook",
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(
        url.toString(),
      )}&show_text=false`,
      sourceUrl: url.toString(),
      title: "Facebook",
    };
  }

  return null;
}

/**
 * An uploaded file's stored path, fit to put in an `href`.
 *
 * The upload code writes either a same-origin `/uploads/…` path (filesystem backend)
 * or an absolute `https://` Blob URL, and nothing else — but the column is plain text
 * that any staff account can edit through the generic form, and a `javascript:` URL in
 * a download button would run in every visitor's browser. Same-origin absolute paths
 * and http(s) URLs pass; everything else (`javascript:`, `data:`, protocol-relative
 * `//host` or `/\host`) is dropped and the button simply does not render.
 */
export function safeFileHref(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  // A single leading slash followed by anything but another slash — or a backslash,
  // which browsers normalise to a slash and so read `/\host` as `//host`.
  if (/^\/(?![\/\\])/.test(raw)) return raw;
  return safeExternalLink(raw);
}

/** A link we will not frame, but can still offer as a plain link. */
export function safeExternalLink(input: string): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}
