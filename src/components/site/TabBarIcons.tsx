/**
 * Icons for the mobile tab bar.
 *
 * Drawn rather than pulled from an icon set: five icons is not worth a dependency, and
 * these are tuned to sit on one optical weight with the site's type — 1.6 stroke on a
 * 24 grid, round joins, no fills. They inherit `currentColor`, so the active state is a
 * colour change on the parent and nothing here needs to know about it.
 */

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  className: "h-6 w-6",
};

export function HomeIcon() {
  return (
    <svg {...base}>
      <path d="M3.5 10.2 12 3.8l8.5 6.4V19a1.3 1.3 0 0 1-1.3 1.3h-3.4v-6H8.2v6H4.8A1.3 1.3 0 0 1 3.5 19z" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg {...base}>
      <rect x="3.5" y="5.2" width="17" height="15.3" rx="1.4" />
      <path d="M3.5 10h17M8.2 3.5v3.4M15.8 3.5v3.4" />
    </svg>
  );
}

/** Guidelines: a document with lines, not a book — these are papers, not chapters. */
export function DocumentIcon() {
  return (
    <svg {...base}>
      <path d="M6 3.5h7.6L19 8.9V20.5H6z" />
      <path d="M13.4 3.5v5.6H19M9 13h6M9 16.6h4.2" />
    </svg>
  );
}

export function PersonIcon() {
  return (
    <svg {...base}>
      <circle cx="12" cy="8.2" r="3.7" />
      <path d="M4.8 20.5a7.2 7.2 0 0 1 14.4 0" />
    </svg>
  );
}

export function MenuIcon() {
  return (
    <svg {...base}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
