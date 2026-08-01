"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/lib/db/types";
import { LOCALE_LABELS, localePath, otherLocale, swapLocaleInPath } from "@/lib/i18n/config";
import type { NavItem } from "@/lib/nav";
import { MsidMark } from "@/components/site/Mark";
import { rememberLocale } from "@/lib/i18n/client";

interface Props {
  locale: Locale;
  nav: NavItem[];
  labels: {
    orgName: string;
    memberArea: string;
    login: string;
    menu: string;
    close: string;
    openMenu: string;
    skipToContent: string;
    switchTo: string;
    language: string;
  };
  signedIn: boolean;
  isStaff: boolean;
  adminLabel: string;
}

/**
 * Two-tier masthead: a thin ink utility strip over a paper bar.
 *
 * The split exists for a concrete reason — MSID's logo is a copper mark on white, so
 * it sits on the paper tier where it reads cleanly, while the ink tier carries the
 * structural weight and the account/language controls that would otherwise clutter the
 * main bar.
 */
export function Masthead({ locale, nav, labels, signedIn, isStaff, adminLabel }: Props) {
  const pathname = usePathname() || `/${locale}`;
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const menuId = useId();

  // Route change closes everything.
  useEffect(() => {
    setSheetOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  // The mobile sheet covers the page; freeze the body behind it.
  useEffect(() => {
    if (!sheetOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [sheetOpen]);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!navRef.current?.contains(event.target as Node)) setOpenMenu(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpenMenu(null);
      setSheetOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const next = otherLocale(locale);
  const switchHref = swapLocaleInPath(pathname, next);
  const accountHref = localePath(
    locale,
    isStaff ? "/admin" : signedIn ? "/portal" : "/login",
  );

  return (
    <>
      <a href="#main" className="sr-only-focusable btn btn-primary absolute top-2 left-2 z-toast">
        {labels.skipToContent}
      </a>

      <header className="sticky top-0 z-sticky">
        {/* Utility tier */}
        <div className="on-dark border-b border-white/10">
          <div className="shell flex h-9 items-center justify-between gap-4 text-[0.8125rem]">
            <p className="hidden truncate text-ink-300 sm:block">{labels.orgName}</p>
            <div className="flex items-center gap-1">
              {/*
                One account link, not two. An administrator has no use for the member
                portal, so staff go straight to the admin; members go to the portal.
              */}
              <Link
                href={accountHref}
                className={`rounded-xs px-2 py-1 font-medium transition-colors duration-100 hover:bg-white/10 hover:text-white ${
                  isStaff ? "text-gold-400" : "text-ink-200"
                }`}
              >
                {isStaff ? adminLabel : signedIn ? labels.memberArea : labels.login}
              </Link>
              <span aria-hidden className="mx-1 h-3.5 w-px bg-white/20" />
              <Link
                href={switchHref}
                hrefLang={next}
                lang={next}
                aria-label={labels.switchTo}
                onClick={() => rememberLocale(next)}
                className="rounded-xs px-2 py-1 font-semibold text-ink-200 transition-colors duration-100 hover:bg-white/10 hover:text-white"
              >
                {LOCALE_LABELS[next]}
              </Link>
            </div>
          </div>
        </div>

        {/* Primary tier */}
        <div className="border-b border-ink-200 bg-paper">
          <div className="shell flex h-16 items-center justify-between gap-6 nav:h-20">
            <Link
              href={localePath(locale, "/")}
              className="flex shrink-0 items-center gap-3 rounded-sm"
            >
              <MsidMark priority className="w-12 shrink-0 nav:w-14" />
              <span className="flex flex-col leading-none">
                <span className="text-[1.35rem] font-extrabold tracking-[-0.03em] text-ink-950 nav:text-2xl">
                  MSID
                </span>
                {/* Wraps to two lines on small tablets otherwise, which pushes the
                    masthead taller than the nav bar it sits in. */}
                <span className="mt-1 hidden max-w-[22ch] text-[0.6875rem] leading-tight font-medium text-ink-600 sm:block md:max-w-none">
                  {labels.orgName}
                </span>
              </span>
            </Link>

            <nav
              ref={navRef}
              aria-label={labels.menu}
              className="hidden items-center gap-1 nav:flex"
            >
              {nav.map((item) => {
                const active = isActive(item.href);
                const expanded = openMenu === item.href;

                if (!item.children) {
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative rounded-sm px-3 py-2 text-[0.9375rem] font-semibold transition-colors duration-100 hover:text-copper-700 ${
                        active ? "text-copper-700" : "text-ink-800"
                      }`}
                    >
                      {item.label}
                      {active && (
                        <span
                          aria-hidden
                          className="absolute inset-x-3 -bottom-px h-0.5 bg-copper-600"
                        />
                      )}
                    </Link>
                  );
                }

                return (
                  <div key={item.href} className="relative">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`${menuId}-${item.href}`}
                      onClick={() => setOpenMenu(expanded ? null : item.href)}
                      className={`relative flex cursor-pointer items-center gap-1.5 rounded-sm px-3 py-2 text-[0.9375rem] font-semibold transition-colors duration-100 hover:text-copper-700 ${
                        active ? "text-copper-700" : "text-ink-800"
                      }`}
                    >
                      {item.label}
                      <svg
                        aria-hidden
                        viewBox="0 0 12 8"
                        className={`h-2 w-3 transition-transform duration-150 ${
                          expanded ? "rotate-180" : ""
                        }`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M1 1.5 6 6.5l5-5" />
                      </svg>
                      {active && (
                        <span
                          aria-hidden
                          className="absolute inset-x-3 -bottom-px h-0.5 bg-copper-600"
                        />
                      )}
                    </button>

                    <div
                      id={`${menuId}-${item.href}`}
                      hidden={!expanded}
                      className="absolute top-full left-0 z-dropdown mt-px min-w-60 border border-ink-200 bg-paper py-1.5 shadow-[0_12px_32px_-12px_oklch(0.175_0.014_45/0.28)]"
                    >
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className="block px-4 py-2 text-[0.9375rem] text-ink-800 transition-colors duration-100 hover:bg-ink-50 hover:text-copper-700"
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              aria-expanded={sheetOpen}
              className="btn btn-secondary shrink-0 cursor-pointer px-3 py-2 nav:hidden"
            >
              <svg aria-hidden viewBox="0 0 18 12" className="h-3 w-4.5" fill="currentColor">
                <rect width="18" height="1.8" y="0" />
                <rect width="18" height="1.8" y="5.1" />
                <rect width="18" height="1.8" y="10.2" />
              </svg>
              {labels.menu}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sheet — full height, not a cramped dropdown */}
      {sheetOpen && (
        <div className="fixed inset-0 z-modal nav:hidden">
          <button
            type="button"
            aria-label={labels.close}
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 cursor-default bg-ink-950/45"
          />
          <div className="animate-fade-up absolute inset-y-0 right-0 flex w-full max-w-sm flex-col overflow-y-auto bg-paper">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-ink-200 px-5">
              <span className="text-xl font-extrabold tracking-[-0.03em] text-ink-950">
                MSID
              </span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                className="btn btn-secondary cursor-pointer px-3 py-2"
              >
                {labels.close}
              </button>
            </div>

            <nav aria-label={labels.menu} className="flex-1 px-5 py-2">
              {nav.map((item) => (
                <div key={item.href} className="border-b border-ink-200 py-3 last:border-0">
                  <Link
                    href={item.href}
                    className={`block py-1.5 text-[1.0625rem] font-semibold ${
                      isActive(item.href) ? "text-copper-700" : "text-ink-900"
                    }`}
                  >
                    {item.label}
                  </Link>
                  {item.children && (
                    <ul className="mt-1">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            className="block py-1.5 text-[0.9375rem] text-ink-700"
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </nav>

            <div className="shrink-0 border-t border-ink-200 px-5 py-4">
              <Link href={accountHref} className="btn btn-primary w-full">
                {isStaff ? adminLabel : signedIn ? labels.memberArea : labels.login}
              </Link>
              <Link
                href={switchHref}
                hrefLang={next}
                lang={next}
                onClick={() => rememberLocale(next)}
                className="btn btn-secondary mt-2 w-full"
              >
                {labels.switchTo}
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
