/**
 * Where this deployment lives, and whether search engines may index it.
 *
 * Both matter most on a preview deployment. A test instance that reports
 * `http://localhost:3000` as its canonical URL emits broken Open Graph images and a
 * useless sitemap, and one that lets itself be indexed puts placeholder clinical
 * content into Google under MSID's name.
 */

/**
 * The public origin, without a trailing slash.
 *
 * Read `MSID_SITE_URL`, **not** `NEXT_PUBLIC_SITE_URL`. Next.js substitutes any
 * `NEXT_PUBLIC_*` variable into the bundle at *build* time, so a value set only in the
 * runtime environment is silently ignored and the site reports whatever the build
 * machine had — `http://localhost:3000` in practice. This value is used exclusively on
 * the server, so an un-prefixed variable is both correct and settable after the build.
 *
 * `NEXT_PUBLIC_SITE_URL` is still honoured as a fallback for existing setups. Failing
 * both, the host platform's own variable is used, so a preview deploy is right without
 * anyone configuring anything — Railway and Render both publish their subdomain.
 */
export function siteUrl(): string {
  const explicit = process.env.MSID_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return `https://${railway.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;

  const render = process.env.RENDER_EXTERNAL_URL?.trim();
  if (render) return render.replace(/\/$/, "");

  const legacy = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (legacy) return legacy.replace(/\/$/, "");

  return "http://localhost:3000";
}

/**
 * True when this deployment must not be indexed.
 *
 * Explicit via `MSID_NOINDEX=1`, and automatic on the free preview domains — a client
 * review instance is full of sample content that would be actively harmful indexed
 * under a medical society's name. Setting a real `NEXT_PUBLIC_SITE_URL` on a custom
 * domain is what turns indexing on, which is the same moment the site becomes real.
 *
 * The admin dashboard shows a warning whenever this is active, so a launched site
 * cannot sit un-indexed without someone being told.
 */
export function isNoIndex(): boolean {
  if (process.env.MSID_NOINDEX === "1") return true;
  if (process.env.MSID_NOINDEX === "0") return false;

  const url = siteUrl();
  return (
    url.includes(".up.railway.app") ||
    url.includes(".onrender.com") ||
    url.includes(".vercel.app") ||
    url.startsWith("http://localhost")
  );
}
