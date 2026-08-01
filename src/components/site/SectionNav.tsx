"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Sub-navigation for a multi-page section (About). Horizontal and scrollable on
 * narrow screens rather than collapsing into a select — a five-item list is faster to
 * scan than a dropdown, and scrolling is a familiar affordance.
 */
export function SectionNav({
  items,
  label,
}: {
  items: { label: string; href: string }[];
  label: string;
}) {
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="border-b border-ink-200">
      <div className="shell">
        <ul className="table-scroll -mx-1 flex gap-1">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href} className="shrink-0">
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
