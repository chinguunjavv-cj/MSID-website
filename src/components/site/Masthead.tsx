"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { Locale } from "@/lib/db/types";
import { LOCALE_LABELS, localePath, otherLocale, swapLocaleInPath } from "@/lib/i18n/config";
import type { NavItem } from "@/lib/nav";
import { MsidMark } from "@/components/site/Mark";
import {
  CalendarIcon,
  DocumentIcon,
  HomeIcon,
  MenuIcon,
  PersonIcon,
} from "@/components/site/TabBarIcons";
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
  const sheetRef = useRef<HTMLDialogElement>(null);
  const menuId = useId();

  // Route change closes everything.
  useEffect(() => {
    setSheetOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  /*
    The sheet is a real modal, so it is a native <dialog> driven by showModal() — the
    same choice the photograph lightbox makes, and for the same reasons: the browser
    puts it in the top layer, makes everything behind it inert, traps Tab inside it, and
    returns focus to whatever opened it. Hand-rolled, this was a plain fixed div a
    keyboard could tab straight out of while the backdrop was still up.
  */
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    if (sheetOpen && !sheet.open) sheet.showModal();
    if (!sheetOpen && sheet.open) sheet.close();
  }, [sheetOpen]);

  // showModal() makes the page inert, but iOS still scrolls the body behind it.
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

  /*
    The tab bar's five destinations. Not the top-level menu in miniature — that has
    Танилцуулга and Хамтын ажиллагаа at the front, which nobody opens a society's site
    on a phone to read. These are what a clinician came for, plus a way to everything
    else.
  */
  const tabs = [
    {
      key: "home",
      href: localePath(locale, "/"),
      /*
        Exact match. The home href is `/mn`, and every other path on the site begins
        with it — so the prefix test used by the other tabs marks Home active on every
        page, including the ones that light up their own tab at the same time.
      */
      exact: true,
      label: locale === "mn" ? "Нүүр" : "Home",
      icon: <HomeIcon />,
    },
    {
      key: "events",
      exact: false,
      href: localePath(locale, "/events"),
      label: locale === "mn" ? "Арга хэмжээ" : "Events",
      icon: <CalendarIcon />,
    },
    {
      key: "guidelines",
      exact: false,
      href: localePath(locale, "/guidelines"),
      label: locale === "mn" ? "Заавар" : "Guidelines",
      icon: <DocumentIcon />,
    },
    {
      key: "account",
      exact: false,
      href: accountHref,
      label: isStaff
        ? locale === "mn"
          ? "Удирдлага"
          : "Admin"
        : signedIn
          ? locale === "mn"
            ? "Гишүүн"
            : "Member"
          : labels.login,
      icon: <PersonIcon />,
    },
    // No href: this one opens the drawer that already exists above.
    { key: "menu", href: null, exact: false, label: labels.menu, icon: <MenuIcon /> },
  ];

  return (
    <>
      <a href="#main" className="sr-only-focusable btn btn-primary absolute top-2 left-2 z-toast">
        {labels.skipToContent}
      </a>

      <header className="sticky top-0 z-sticky">
        {/* Utility tier. Account and language only — the Society's name lives once on
            this screen, in the lockup below, not here as well. */}
        <div className="on-dark border-b border-white/10">
          <div className="shell flex h-9 items-center justify-end gap-4 text-[0.8125rem]">
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
                {/* The one place the full name appears on the first screen, so it is
                    no longer hidden on phones. Capped so it wraps to two tidy lines
                    inside the bar's height rather than stretching it. */}
                <span className="mt-1 block max-w-[24ch] text-[0.6875rem] leading-tight font-medium text-ink-600 md:max-w-none">
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
              /* Shown on a mouse-driven narrow window; hidden on touch, where the tab
                 bar owns navigation. globals.css decides, on pointer type. */
              className="masthead-menu-button btn btn-secondary shrink-0 cursor-pointer px-3 py-2"
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
      <dialog
        ref={sheetRef}
        aria-label={labels.menu}
        /* Escape and the backdrop both route through the same state, so the dialog and
           React never disagree about whether it is open. */
        onClose={() => setSheetOpen(false)}
        onCancel={() => setSheetOpen(false)}
        onClick={(event) => {
          if (event.target === sheetRef.current) setSheetOpen(false);
        }}
        className="sheet nav:hidden"
      >
        <div className="animate-fade-up absolute inset-y-0 right-0 flex w-full max-w-sm flex-col overflow-y-auto overscroll-contain bg-paper">
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

            {/*
              Sections fold. Listing every parent with all of its children expanded made
              the sheet a nineteen-item wall a visitor had to scroll past to reach the
              one thing they came for (Chinguun, August 2026). `<details>` does this
              natively: it is keyboard operable, it announces expanded state to a screen
              reader, and it needs no JavaScript — so the menu still works if the page's
              scripts never arrive, which on hospital wifi is not hypothetical.

              The section the visitor is currently inside opens on arrival.
            */}
            <nav aria-label={labels.menu} className="flex-1 px-5 py-2">
              {nav.map((item) =>
                item.children ? (
                  <details
                    key={item.href}
                    open={isActive(item.href)}
                    className="group border-b border-ink-200 last:border-0"
                  >
                    <summary
                      className={`flex cursor-pointer list-none items-center justify-between py-4 text-body font-semibold marker:content-none ${
                        isActive(item.href) ? "text-copper-700" : "text-ink-900"
                      }`}
                    >
                      {item.label}
                      <svg
                        aria-hidden
                        viewBox="0 0 12 8"
                        className="h-2 w-3 shrink-0 text-ink-600 transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      >
                        <path d="M1 1.5 6 6.5l5-5" />
                      </svg>
                    </summary>

                    {/* No link back to the parent: every section's own href is already
                        its first child's — Танилцуулга and Мэндчилгээ are both /about —
                        so repeating it listed the same page twice. */}
                    <ul className="pb-2">
                      {item.children.map((child) => (
                        <li key={child.href}>
                          <Link
                            href={child.href}
                            aria-current={pathname === child.href ? "page" : undefined}
                            className={`block py-2 text-small ${
                              pathname === child.href
                                ? "font-medium text-copper-700"
                                : "text-ink-700"
                            }`}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <div key={item.href} className="border-b border-ink-200 last:border-0">
                    <Link
                      href={item.href}
                      className={`block py-4 text-body font-semibold ${
                        isActive(item.href) ? "text-copper-700" : "text-ink-900"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </div>
                ),
              )}
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
      </dialog>

      {/*
        Mobile tab bar.

        A phone's reachable area is the bottom of the screen, and the four things a
        clinician actually opens the site for — what is coming up, the guidelines, their
        membership, everything else — now sit under the thumb instead of behind a menu
        button in the top corner. The header's own menu button is hidden at these widths
        so there is one way in, not two.
      */}
      <nav
        aria-label={labels.menu}
        className="tab-bar fixed inset-x-0 bottom-0 z-sticky border-t border-ink-200 bg-paper pb-[env(safe-area-inset-bottom)]"
      >
        {/*
          Capped and centred. The bar itself spans the width, but on an iPad the five
          tabs stretched to 150px apiece and read as a stretched phone layout rather
          than a deliberate one. Below 28rem the cap does nothing, so a phone is
          unchanged.
        */}
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {tabs.map((tab) => {
            const active = tab.href
              ? tab.exact
                ? pathname === tab.href
                : isActive(tab.href)
              : false;
            const content = (
              <>
                {tab.icon}
                {/*
                  Scales with the viewport and never wraps. "Арга хэмжээ" is two words
                  and the honest label for what that section holds — at 320px it broke
                  onto a second line and threw that tab out of line with the other four.
                */}
                <span className="text-[clamp(0.625rem,2.9vw,0.6875rem)] leading-none font-medium whitespace-nowrap">
                  {tab.label}
                </span>
              </>
            );
            // A 3.25rem target clears the 44px minimum with the label inside it.
            const shared = `relative flex h-[3.25rem] w-full flex-col items-center justify-center gap-1 ${
              active ? "text-copper-700" : "text-ink-600"
            }`;

            return (
              <li key={tab.key} className="contents">
                {tab.href ? (
                  <Link
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={shared}
                  >
                    {/* The rule repeats the colour change, so the active tab is not
                        signalled by hue alone. */}
                    {active && (
                      <span aria-hidden className="absolute inset-x-3 top-0 h-0.5 bg-copper-600" />
                    )}
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    aria-expanded={sheetOpen}
                    className={`${shared} cursor-pointer`}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
