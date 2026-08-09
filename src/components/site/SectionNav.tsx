"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useId } from "react";

/**
 * Sub-navigation for a multi-page section (About).
 *
 * Two shapes, because one shape could not serve both widths.
 *
 * On a wide screen it is a row of tabs — five short labels scan instantly and the
 * current page carries a copper rule.
 *
 * On a phone it is a native select. It scrolled sideways first, which clipped most of
 * the section off both edges of the screen; then it wrapped, which put two labels on
 * one line and three on the next with ragged gaps and an underline stranded mid-row
 * (Chinguun, August 2026). A select is one line at any width, needs no gesture anyone
 * has to discover, and comes with the platform's own picker — which on a phone is a
 * better list than anything drawn here.
 */
export function SectionNav({
  items,
  label,
}: {
  items: { label: string; href: string }[];
  label: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const selectId = useId();

  // A page not in the list would otherwise silently show the first entry as current.
  const current = items.find((item) => item.href === pathname)?.href ?? "";

  return (
    <nav aria-label={label} className="border-b border-ink-200">
      <div className="shell">
        <div className="py-3 md:hidden">
          <label htmlFor={selectId} className="sr-only">
            {label}
          </label>
          <select
            id={selectId}
            className="select font-semibold"
            value={current}
            onChange={(event) => router.push(event.target.value)}
          >
            {/* Only reachable if the current URL is not one of the section's pages. */}
            {current === "" && <option value="">—</option>}
            {items.map((item) => (
              <option key={item.href} value={item.href}>
                {item.label}
              </option>
            ))}
          </select>
        </div>

        <ul className="-mx-3 hidden gap-1 md:flex">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative block px-3 py-4 text-small font-semibold whitespace-nowrap transition-colors duration-100 hover:text-copper-700 ${
                    active ? "text-copper-700" : "text-ink-700"
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
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
