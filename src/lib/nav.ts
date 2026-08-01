import type { Locale } from "@/lib/db/types";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localePath } from "@/lib/i18n/config";

export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  children?: NavChild[];
}

/**
 * The five top-level menus.
 *
 * Nav labels are deliberately shorter than page titles — "Танилцуулга" in the bar,
 * "Нийгэмлэгийн тухай" as the page heading. Mongolian labels run long, and a nav that
 * wraps is worse than one that abbreviates.
 */
export function mainNav(locale: Locale): NavItem[] {
  const t = getDictionary(locale);
  const p = (path: string) => localePath(locale, path);

  return [
    {
      label: locale === "mn" ? "Танилцуулга" : t.nav.about,
      href: p("/about"),
      children: [
        { label: t.aboutNav.welcome, href: p("/about") },
        { label: t.aboutNav.mission, href: p("/about/mission") },
        { label: t.aboutNav.history, href: p("/about/history") },
        { label: t.aboutNav.board, href: p("/about/board") },
        { label: t.aboutNav.contact, href: p("/about/contact") },
      ],
    },
    {
      label: locale === "mn" ? "Арга хэмжээ" : t.nav.events,
      href: p("/events"),
      children: [
        { label: t.eventsNav.upcoming, href: p("/events") },
        { label: t.eventsNav.past, href: p("/events/past") },
        { label: t.eventsNav.news, href: p("/news") },
        { label: t.eventsNav.membership, href: p("/membership") },
      ],
    },
    { label: t.nav.publications, href: p("/publications") },
    { label: t.nav.collaboration, href: p("/collaboration") },
    { label: t.nav.guidelines, href: p("/guidelines") },
  ];
}

export const ADMIN_SECTIONS = [
  { key: "dashboard", href: "", mn: "Хяналтын самбар", en: "Dashboard" },
  { key: "events", href: "/events", mn: "Арга хэмжээ", en: "Events" },
  { key: "registrations", href: "/registrations", mn: "Бүртгэл", en: "Registrations" },
  { key: "members", href: "/members", mn: "Гишүүд", en: "Members" },
  { key: "guidelines", href: "/guidelines", mn: "Эмнэлзүйн заавар", en: "Guidelines" },
  { key: "publications", href: "/publications", mn: "Эрдэм шинжилгээ", en: "Publications" },
  { key: "news", href: "/news", mn: "Мэдээ", en: "News" },
  { key: "pages", href: "/pages", mn: "Хуудсууд", en: "Pages" },
  { key: "history", href: "/history", mn: "Түүхэн замнал", en: "History" },
  { key: "board", href: "/board", mn: "Удирдах зөвлөл", en: "Board" },
  { key: "partners", href: "/partners", mn: "Түншүүд", en: "Partners" },
  { key: "settings", href: "/settings", mn: "Тохиргоо", en: "Settings" },
  { key: "users", href: "/users", mn: "Хэрэглэгчид", en: "Users" },
] as const;
