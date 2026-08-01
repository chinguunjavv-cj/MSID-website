import Link from "next/link";

/**
 * Locale-agnostic 404: `notFound()` unwinds past the layout that resolved the locale,
 * so this page cannot read `params`. Both languages are shown rather than guessing.
 */
export default function LocaleNotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-24 text-center">
      <p className="tabular text-label font-semibold text-copper-700">404</p>

      <h1 className="mt-4 max-w-[22ch] text-h1 font-bold">Хуудас олдсонгүй</h1>
      <p className="mt-3 max-w-[46ch] text-ink-600">
        Хайсан хуудас олдсонгүй эсвэл шилжсэн байна.
      </p>

      <h2 className="mt-10 max-w-[22ch] text-h3 font-bold" lang="en">
        Page not found
      </h2>
      <p className="mt-2 max-w-[46ch] text-ink-600" lang="en">
        The page you are looking for does not exist or has moved.
      </p>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <Link href="/mn" className="btn btn-primary">
          Нүүр хуудас
        </Link>
        <Link href="/en" className="btn btn-secondary" lang="en">
          Home
        </Link>
      </div>
    </div>
  );
}
