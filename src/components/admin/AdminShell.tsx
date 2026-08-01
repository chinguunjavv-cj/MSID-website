"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/db/types";
import { LOCALE_LABELS, localePath, otherLocale, swapLocaleInPath } from "@/lib/i18n/config";
import { rememberLocale } from "@/lib/i18n/client";

export interface AdminNavItem {
  key: string;
  href: string;
  label: string;
  badge?: number;
}

/**
 * Admin shell: top bar plus a side navigation that collapses to a disclosure on
 * narrow screens. Ink-neutral chrome — copper appears only on the active item and the
 * primary action, per the product register.
 */
export function AdminShell({
  locale,
  items,
  userName,
  children,
  labels,
  signOut,
}: {
  locale: Locale;
  items: AdminNavItem[];
  userName: string;
  children: React.ReactNode;
  labels: { title: string; viewSite: string; signOut: string; menu: string };
  signOut: (formData: FormData) => void | Promise<void>;
}) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const next = otherLocale(locale);

  const isActive = (href: string) => {
    const base = localePath(locale, "/admin");
    if (href === base) return pathname === base;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <div className="flex min-h-full flex-col">
      <header className="on-dark sticky top-0 z-sticky">
        <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              className="cursor-pointer rounded-sm border border-white/25 px-2.5 py-1.5 text-[0.8125rem] font-medium text-ink-200 transition-colors duration-100 hover:bg-white/10 lg:hidden"
            >
              {labels.menu}
            </button>
            <Link href={localePath(locale, "/admin")} className="flex items-baseline gap-2">
              <span className="text-lg font-extrabold tracking-[-0.03em] text-paper">
                MSID
              </span>
              <span className="text-[0.8125rem] text-ink-400">{labels.title}</span>
            </Link>
          </div>

          <div className="flex items-center gap-1 text-[0.8125rem]">
            <span className="mr-2 hidden text-ink-400 sm:inline">{userName}</span>
            <Link
              href={localePath(locale, "/")}
              className="rounded-xs px-2 py-1 text-ink-200 transition-colors duration-100 hover:bg-white/10 hover:text-white"
            >
              {labels.viewSite}
            </Link>
            <Link
              href={swapLocaleInPath(pathname, next)}
              hrefLang={next}
              onClick={() => rememberLocale(next)}
              className="rounded-xs px-2 py-1 font-semibold text-ink-200 transition-colors duration-100 hover:bg-white/10 hover:text-white"
            >
              {LOCALE_LABELS[next]}
            </Link>
            <form action={signOut}>
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                className="cursor-pointer rounded-xs px-2 py-1 text-ink-200 transition-colors duration-100 hover:bg-white/10 hover:text-white"
              >
                {labels.signOut}
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col lg:flex-row">
        <nav
          aria-label={labels.title}
          className={`${open ? "block" : "hidden"} shrink-0 border-b border-ink-200 bg-ink-50 lg:block lg:w-60 lg:border-r lg:border-b-0`}
        >
          <ul className="p-3 lg:sticky lg:top-14">
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between gap-2 rounded-sm px-3 py-2 text-small font-medium transition-colors duration-100 ${
                      active
                        ? "bg-copper-700 text-paper"
                        : "text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`tabular rounded-xs px-1.5 py-0.5 text-[0.75rem] font-semibold ${
                          active ? "bg-white/20 text-paper" : "bg-status-pending-bg text-status-pending"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 px-4 py-8 md:px-8 md:py-10">{children}</main>
      </div>
    </div>
  );
}
