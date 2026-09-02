/**
 * Site-settings shape and defaults.
 *
 * Kept free of imports on purpose: the seed script runs outside Next.js under Node's
 * type stripping, where the `@/*` path alias does not resolve. Anything the seed needs
 * lives in a module with no alias imports.
 *
 * Defaults are MSID's own published details.
 */
export interface SiteSettings {
  contact_address_mn: string;
  contact_address_en: string;
  contact_phone: string;
  contact_email: string;
  contact_hours_mn: string;
  contact_hours_en: string;
  contact_map_url: string;
  facebook_url: string;
  founded_on: string;
  bank_name_mn: string;
  bank_name_en: string;
  bank_account_number: string;
  bank_account_name: string;
  qpay_enabled: string;
  hero_background: string;
  section_banner: string;
  hero_image: string;
  hero_image_alt_mn: string;
  hero_image_alt_en: string;
  hero_headline_mn: string;
  hero_headline_en: string;
  hero_lead_mn: string;
  hero_lead_en: string;
}

export type SettingKey = keyof SiteSettings;

export const SETTING_DEFAULTS: SiteSettings = {
  contact_address_mn:
    "С.Зоригийн гудамж 2, Улсын клиникийн төв эмнэлэг (1-р эмнэлэг), Сүхбаатар дүүрэг, 1-р хороо, Улаанбаатар 14210, Монгол Улс",
  contact_address_en:
    "2 S. Zorig Street, State Central Clinical Hospital (First Hospital), Sukhbaatar District, 1st Khoroo, Ulaanbaatar 14210, Mongolia",
  contact_phone: "+976 9907 5158",
  contact_email: "ibdmsid@gmail.com",
  contact_hours_mn: "Даваа–Баасан, 09:00–17:00",
  contact_hours_en: "Monday–Friday, 09:00–17:00",
  contact_map_url: "",
  facebook_url: "https://www.facebook.com/profile.php?id=61572766224231",
  founded_on: "2024-03-05",
  bank_name_mn: "",
  bank_name_en: "",
  bank_account_number: "",
  bank_account_name: "",
  qpay_enabled: "0",
  /*
    The Society's chosen ground (31 Aug 2026): red steppe escarpment, Pexels photo
    16357527 by Nicephotorussia (Pexels licence — free use, no attribution required),
    resized into the repo at public/brand/hero-bg.jpg. A default rather than a
    hardcode so an administrator can clear the field and get the plain ruled hero
    back, or replace the file with the Society's own photograph later.
  */
  hero_background: "/brand/hero-bg.jpg",
  /*
    The same ground behind every section title. One setting rather than one per
    page: the band is short and reads as the Society's masthead texture, not as a
    picture of anything, and twelve separate uploads would be twelve chances for a
    section to end up looking like a different site. Clear it and the interior
    headers go back to type on paper.
  */
  section_banner: "/brand/hero-bg.jpg",
  hero_image: "",
  hero_image_alt_mn: "",
  hero_image_alt_en: "",
  hero_headline_mn: "",
  hero_headline_en: "",
  hero_lead_mn: "",
  hero_lead_en: "",
};
