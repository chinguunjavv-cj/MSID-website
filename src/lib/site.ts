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
 * both, the host platform's own variable is used, so a deploy is correct without anyone
 * configuring anything — Vercel, Railway and Render all publish their own domain.
 */
export function siteUrl(): string {
  const explicit = process.env.MSID_SITE_URL?.trim();
  if (explicit) return withProtocol(explicit);

  /*
    Vercel exposes two: the stable production domain and the per-deployment URL. Prefer
    the production one so canonical tags and the sitemap do not point at a deployment
    hash that changes on every push; fall back to the deployment URL on previews, which
    have no production domain of their own.
  */
  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction && process.env.VERCEL_ENV === "production") {
    return withProtocol(vercelProduction);
  }
  const vercelDeployment = process.env.VERCEL_URL?.trim();
  if (vercelDeployment) return withProtocol(vercelDeployment);
  if (vercelProduction) return withProtocol(vercelProduction);

  const railway = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railway) return withProtocol(railway);

  const render = process.env.RENDER_EXTERNAL_URL?.trim();
  if (render) return withProtocol(render);

  const legacy = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (legacy) return withProtocol(legacy);

  return "http://localhost:3000";
}

/** Platform variables give a bare hostname; a configured value may already have one. */
function withProtocol(value: string): string {
  const trimmed = value.replace(/\/$/, "");
  return /^https?:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
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
