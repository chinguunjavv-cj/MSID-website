import type { Locale } from "@/lib/db/types";

/**
 * The admin's content registry.
 *
 * Every editable entity is a bilingual record with a status, so rather than twelve
 * near-identical forms there is one editor driven by these definitions. The registry
 * is also the security boundary: table and column names used in generated SQL are
 * taken from here and never from request data.
 */

export type FieldKind =
  | "text"
  | "textarea"
  | "date"
  | "datetime"
  | "number"
  | "select"
  | "checkbox"
  | "image"
  | "file";

export interface Bi {
  mn: string;
  en: string;
}

export interface FieldDef {
  /** Column name, or the base name when `bilingual` (e.g. `title` → title_mn/title_en). */
  name: string;
  label: Bi;
  kind: FieldKind;
  bilingual?: boolean;
  required?: boolean;
  hint?: Bi;
  options?: { value: string; label: Bi }[];
  /** Populates a select from another table's published rows (self-reference safe). */
  optionsFrom?: { table: string; labelColumn: string; excludeSelf?: boolean };
  section?: Bi;
  placeholder?: string;
}

export interface ResourceDef {
  key: string;
  table: string;
  singular: Bi;
  plural: Bi;
  /** Base field used to generate the slug. Omit for tables with no slug column. */
  slugFrom?: string;
  /** Columns shown in the list table, in order. */
  listPrimary: string;
  listDate?: string;
  listStatus?: boolean;
  defaultOrder: string;
  fields: FieldDef[];
  /** Fixed-key resources are edited but never created or deleted. */
  fixed?: boolean;
  idColumn?: string;
}

const STATUS_OPTIONS = [
  { value: "draft", label: { mn: "Төсөл", en: "Draft" } },
  { value: "published", label: { mn: "Нийтэлсэн", en: "Published" } },
  { value: "archived", label: { mn: "Архивласан", en: "Archived" } },
];

const SECTION_CONTENT: Bi = { mn: "Агуулга", en: "Content" };
const SECTION_DATES: Bi = { mn: "Огноо", en: "Dates" };
const SECTION_MEDIA: Bi = { mn: "Зураг, файл", en: "Media" };
const SECTION_SETTINGS: Bi = { mn: "Тохиргоо", en: "Settings" };

export const RESOURCES: Record<string, ResourceDef> = {
  events: {
    key: "events",
    table: "events",
    singular: { mn: "Арга хэмжээ", en: "Event" },
    plural: { mn: "Арга хэмжээ", en: "Events" },
    slugFrom: "title",
    listPrimary: "title",
    listDate: "starts_on",
    listStatus: true,
    defaultOrder: "starts_on IS NULL, starts_on DESC, created_at DESC",
    fields: [
      {
        name: "status",
        label: { mn: "Төлөв", en: "Status" },
        kind: "select",
        options: STATUS_OPTIONS,
        section: SECTION_SETTINGS,
      },
      {
        name: "kind",
        label: { mn: "Төрөл", en: "Type" },
        kind: "select",
        section: SECTION_SETTINGS,
        options: [
          { value: "congress", label: { mn: "Их хурал", en: "Congress" } },
          { value: "training", label: { mn: "Сургалт", en: "Training" } },
          { value: "conference", label: { mn: "Эрдэм шинжилгээний хурал", en: "Scientific meeting" } },
          { value: "webinar", label: { mn: "Цахим хурал", en: "Webinar" } },
          { value: "case_conference", label: { mn: "Кейс хэлэлцүүлэг", en: "Case conference" } },
        ],
      },
      {
        name: "is_featured",
        label: { mn: "Нүүр хуудсанд онцлох", en: "Feature on home page" },
        kind: "checkbox",
        section: SECTION_SETTINGS,
      },
      { name: "title", label: { mn: "Гарчиг", en: "Title" }, kind: "text", bilingual: true, required: true, section: SECTION_CONTENT },
      { name: "summary", label: { mn: "Товч тайлбар", en: "Summary" }, kind: "textarea", bilingual: true, section: SECTION_CONTENT },
      { name: "body", label: { mn: "Дэлгэрэнгүй", en: "Body" }, kind: "textarea", bilingual: true, section: SECTION_CONTENT },
      { name: "venue", label: { mn: "Байршил", en: "Venue" }, kind: "text", bilingual: true, section: SECTION_CONTENT },
      { name: "city", label: { mn: "Хот", en: "City" }, kind: "text", bilingual: true, section: SECTION_CONTENT },
      { name: "starts_on", label: { mn: "Эхлэх огноо", en: "Start date" }, kind: "date", section: SECTION_DATES },
      { name: "ends_on", label: { mn: "Дуусах огноо", en: "End date" }, kind: "date", section: SECTION_DATES },
      { name: "abstract_deadline", label: { mn: "Илтгэлийн хураангуйн эцсийн хугацаа", en: "Abstract deadline" }, kind: "date", section: SECTION_DATES },
      { name: "early_bird_deadline", label: { mn: "Хөнгөлөлттэй бүртгэлийн эцсийн хугацаа", en: "Early-bird deadline" }, kind: "date", section: SECTION_DATES },
      {
        name: "registration_open",
        label: { mn: "Бүртгэл нээх", en: "Registration open" },
        kind: "checkbox",
        section: SECTION_DATES,
        hint: {
          mn: "Энэ тэмдэглэгээ болон доорх огноо хоёулаа бүртгэлийг зохицуулна.",
          en: "Registration is open only when this is ticked and today falls inside the dates below.",
        },
      },
      { name: "registration_opens_on", label: { mn: "Бүртгэл нээгдэх", en: "Registration opens" }, kind: "date", section: SECTION_DATES },
      { name: "registration_closes_on", label: { mn: "Бүртгэл хаагдах", en: "Registration closes" }, kind: "date", section: SECTION_DATES },
      { name: "capacity", label: { mn: "Багтаамж", en: "Capacity" }, kind: "number", section: SECTION_DATES },
      { name: "cover_image", label: { mn: "Нүүр зураг", en: "Cover image" }, kind: "image", section: SECTION_MEDIA },
      { name: "cover_alt", label: { mn: "Зургийн тайлбар", en: "Image alt text" }, kind: "text", bilingual: true, section: SECTION_MEDIA },
      { name: "external_url", label: { mn: "Гадаад холбоос", en: "External URL" }, kind: "text", section: SECTION_MEDIA },
      {
        name: "video_url",
        label: { mn: "Бичлэгийн холбоос", en: "Video link" },
        kind: "text",
        section: SECTION_MEDIA,
        placeholder: "https://www.youtube.com/watch?v=…",
        hint: {
          mn: "YouTube, Vimeo, Facebook-ийн бичлэгийн холбоосыг буулгана уу. Бичлэг хуудсанд шууд тусна.",
          en: "Paste a YouTube, Vimeo or Facebook video link. It is embedded directly in the page.",
        },
      },
    ],
  },

  guidelines: {
    key: "guidelines",
    table: "guidelines",
    singular: { mn: "Эмнэлзүйн заавар", en: "Guideline" },
    plural: { mn: "Эмнэлзүйн заавар", en: "Guidelines" },
    slugFrom: "title",
    listPrimary: "title",
    listDate: "effective_from",
    listStatus: true,
    defaultOrder: "effective_from DESC, created_at DESC",
    fields: [
      {
        name: "status",
        label: { mn: "Төлөв", en: "Status" },
        kind: "select",
        section: SECTION_SETTINGS,
        options: [
          { value: "draft", label: { mn: "Төсөл", en: "Draft" } },
          { value: "review", label: { mn: "Хянагдаж буй", en: "Under review" } },
          { value: "published", label: { mn: "Хүчин төгөлдөр", en: "In force" } },
          { value: "superseded", label: { mn: "Хүчингүй болсон", en: "Superseded" } },
        ],
      },
      { name: "code", label: { mn: "Код", en: "Code" }, kind: "text", section: SECTION_SETTINGS, placeholder: "MSID-CG-2026-01" },
      { name: "version", label: { mn: "Хувилбар", en: "Version" }, kind: "text", section: SECTION_SETTINGS, placeholder: "1.0" },
      {
        name: "supersedes_id",
        label: { mn: "Орлож буй баримт", en: "Supersedes" },
        kind: "select",
        section: SECTION_SETTINGS,
        optionsFrom: { table: "guidelines", labelColumn: "title", excludeSelf: true },
      },
      { name: "title", label: { mn: "Гарчиг", en: "Title" }, kind: "text", bilingual: true, required: true, section: SECTION_CONTENT },
      { name: "category", label: { mn: "Ангилал", en: "Category" }, kind: "text", bilingual: true, section: SECTION_CONTENT },
      { name: "summary", label: { mn: "Товч тайлбар", en: "Summary" }, kind: "textarea", bilingual: true, section: SECTION_CONTENT },
      { name: "body", label: { mn: "Бүрэн эх", en: "Full text" }, kind: "textarea", bilingual: true, section: SECTION_CONTENT },
      { name: "approved_on", label: { mn: "Батлагдсан огноо", en: "Approved on" }, kind: "date", section: SECTION_DATES },
      { name: "effective_from", label: { mn: "Хүчин төгөлдөр болох", en: "Effective from" }, kind: "date", section: SECTION_DATES },
      { name: "review_due", label: { mn: "Дахин хянах", en: "Review due" }, kind: "date", section: SECTION_DATES },
      { name: "file_path", label: { mn: "PDF файл", en: "PDF file" }, kind: "file", section: SECTION_MEDIA },
    ],
  },

  publications: {
    key: "publications",
    table: "publications",
    singular: { mn: "Бүтээл", en: "Publication" },
    plural: { mn: "Эрдэм шинжилгээний бүтээл", en: "Publications" },
    slugFrom: "title",
    listPrimary: "title",
    listDate: "published_on",
    listStatus: true,
    defaultOrder: "published_on DESC, created_at DESC",
    fields: [
      { name: "status", label: { mn: "Төлөв", en: "Status" }, kind: "select", options: STATUS_OPTIONS, section: SECTION_SETTINGS },
      {
        name: "kind",
        label: { mn: "Төрөл", en: "Type" },
        kind: "select",
        section: SECTION_SETTINGS,
        options: [
          { value: "article", label: { mn: "Нийтлэл", en: "Article" } },
          { value: "issue", label: { mn: "Дугаар", en: "Issue" } },
          { value: "abstract", label: { mn: "Хураангуй", en: "Abstract" } },
          { value: "report", label: { mn: "Тайлан", en: "Report" } },
        ],
      },
      { name: "title", label: { mn: "Гарчиг", en: "Title" }, kind: "text", bilingual: true, required: true, section: SECTION_CONTENT },
      { name: "authors", label: { mn: "Зохиогч", en: "Authors" }, kind: "text", bilingual: true, section: SECTION_CONTENT },
      { name: "abstract", label: { mn: "Хураангуй", en: "Abstract" }, kind: "textarea", bilingual: true, section: SECTION_CONTENT },
      { name: "journal", label: { mn: "Сэтгүүл", en: "Journal" }, kind: "text", bilingual: true, section: SECTION_CONTENT },
      { name: "volume", label: { mn: "Боть", en: "Volume" }, kind: "text", section: SECTION_SETTINGS },
      { name: "issue", label: { mn: "Дугаар", en: "Issue" }, kind: "text", section: SECTION_SETTINGS },
      { name: "pages", label: { mn: "Хуудас", en: "Pages" }, kind: "text", section: SECTION_SETTINGS },
      { name: "doi", label: { mn: "DOI", en: "DOI" }, kind: "text", section: SECTION_SETTINGS },
      { name: "published_on", label: { mn: "Нийтэлсэн огноо", en: "Published on" }, kind: "date", section: SECTION_DATES },
      { name: "external_url", label: { mn: "Эх сурвалжийн холбоос", en: "Source URL" }, kind: "text", section: SECTION_MEDIA },
      { name: "file_path", label: { mn: "PDF файл", en: "PDF file" }, kind: "file", section: SECTION_MEDIA },
      { name: "cover_image", label: { mn: "Хавтасны зураг", en: "Cover image" }, kind: "image", section: SECTION_MEDIA },
    ],
  },

  news: {
    key: "news",
    table: "news_posts",
    singular: { mn: "Мэдээ", en: "News post" },
    plural: { mn: "Мэдээ", en: "News" },
    slugFrom: "title",
    listPrimary: "title",
    listDate: "published_at",
    listStatus: true,
    defaultOrder: "COALESCE(published_at, created_at) DESC",
    fields: [
      { name: "status", label: { mn: "Төлөв", en: "Status" }, kind: "select", options: STATUS_OPTIONS, section: SECTION_SETTINGS },
      { name: "published_at", label: { mn: "Нийтлэх огноо", en: "Publish date" }, kind: "date", section: SECTION_SETTINGS },
      { name: "title", label: { mn: "Гарчиг", en: "Title" }, kind: "text", bilingual: true, required: true, section: SECTION_CONTENT },
      { name: "excerpt", label: { mn: "Товч", en: "Excerpt" }, kind: "textarea", bilingual: true, section: SECTION_CONTENT },
      { name: "body", label: { mn: "Агуулга", en: "Body" }, kind: "textarea", bilingual: true, section: SECTION_CONTENT },
      { name: "cover_image", label: { mn: "Нүүр зураг", en: "Cover image" }, kind: "image", section: SECTION_MEDIA },
      { name: "cover_alt", label: { mn: "Зургийн тайлбар", en: "Image alt text" }, kind: "text", bilingual: true, section: SECTION_MEDIA },
      {
        name: "video_url",
        label: { mn: "Бичлэгийн холбоос", en: "Video link" },
        kind: "text",
        section: SECTION_MEDIA,
        placeholder: "https://www.youtube.com/watch?v=…",
        hint: {
          mn: "YouTube, Vimeo, Facebook-ийн бичлэгийн холбоосыг буулгана уу. Бичлэг хуудсанд шууд тусна.",
          en: "Paste a YouTube, Vimeo or Facebook video link. It is embedded directly in the page.",
        },
      },
    ],
  },

  board: {
    key: "board",
    table: "board_members",
    singular: { mn: "Гишүүн", en: "Board member" },
    plural: { mn: "Удирдах зөвлөл", en: "Executive board" },
    listPrimary: "name",
    listStatus: false,
    defaultOrder: "sort, name_mn",
    fields: [
      { name: "name", label: { mn: "Овог, нэр", en: "Name" }, kind: "text", bilingual: true, required: true, section: SECTION_CONTENT },
      { name: "role", label: { mn: "Албан тушаал", en: "Role" }, kind: "text", bilingual: true, section: SECTION_CONTENT },
      { name: "degree", label: { mn: "Эрдмийн зэрэг", en: "Degree" }, kind: "text", section: SECTION_CONTENT },
      { name: "institution", label: { mn: "Ажлын газар", en: "Institution" }, kind: "text", bilingual: true, section: SECTION_CONTENT },
      { name: "bio", label: { mn: "Товч намтар", en: "Biography" }, kind: "textarea", bilingual: true, section: SECTION_CONTENT },
      { name: "term_from", label: { mn: "Бүрэн эрх эхэлсэн", en: "Term from" }, kind: "date", section: SECTION_DATES },
      { name: "term_to", label: { mn: "Бүрэн эрх дуусах", en: "Term to" }, kind: "date", section: SECTION_DATES },
      { name: "is_current", label: { mn: "Одоогийн бүрэлдэхүүн", en: "Current member" }, kind: "checkbox", section: SECTION_SETTINGS },
      { name: "sort", label: { mn: "Эрэмбэ", en: "Sort order" }, kind: "number", section: SECTION_SETTINGS },
      { name: "photo", label: { mn: "Зураг", en: "Photograph" }, kind: "image", section: SECTION_MEDIA },
    ],
  },

  partners: {
    key: "partners",
    table: "partners",
    singular: { mn: "Түнш", en: "Partner" },
    plural: { mn: "Түншүүд", en: "Partners" },
    listPrimary: "name",
    listStatus: false,
    defaultOrder: "sort, name_en",
    fields: [
      { name: "name", label: { mn: "Байгууллагын нэр", en: "Organisation name" }, kind: "text", bilingual: true, required: true, section: SECTION_CONTENT },
      { name: "acronym", label: { mn: "Товчилсон нэр", en: "Acronym" }, kind: "text", section: SECTION_CONTENT },
      { name: "country", label: { mn: "Улс", en: "Country" }, kind: "text", bilingual: true, section: SECTION_CONTENT },
      { name: "description", label: { mn: "Тайлбар", en: "Description" }, kind: "textarea", bilingual: true, section: SECTION_CONTENT },
      {
        name: "kind",
        label: { mn: "Төрөл", en: "Type" },
        kind: "select",
        section: SECTION_SETTINGS,
        options: [
          { value: "society", label: { mn: "Мэргэжлийн нийгэмлэг", en: "Professional society" } },
          { value: "academic", label: { mn: "Эрдэм шинжилгээний байгууллага", en: "Academic body" } },
          { value: "sponsor", label: { mn: "Дэмжигч", en: "Supporter" } },
          { value: "government", label: { mn: "Төрийн байгууллага", en: "Government body" } },
        ],
      },
      { name: "sort", label: { mn: "Эрэмбэ", en: "Sort order" }, kind: "number", section: SECTION_SETTINGS },
      { name: "url", label: { mn: "Вэбсайт", en: "Website" }, kind: "text", section: SECTION_MEDIA },
      { name: "logo", label: { mn: "Лого", en: "Logo" }, kind: "image", section: SECTION_MEDIA },
    ],
  },

  history: {
    key: "history",
    table: "history_entries",
    singular: { mn: "Түүхэн үйл явдал", en: "History entry" },
    plural: { mn: "Түүхэн замнал", en: "History" },
    listPrimary: "title",
    listDate: "happened_on",
    listStatus: false,
    defaultOrder: "year DESC, sort",
    fields: [
      { name: "year", label: { mn: "Он", en: "Year" }, kind: "number", required: true, section: SECTION_DATES },
      { name: "happened_on", label: { mn: "Огноо", en: "Date" }, kind: "date", section: SECTION_DATES },
      { name: "sort", label: { mn: "Эрэмбэ", en: "Sort order" }, kind: "number", section: SECTION_DATES },
      { name: "title", label: { mn: "Гарчиг", en: "Title" }, kind: "text", bilingual: true, required: true, section: SECTION_CONTENT },
      { name: "body", label: { mn: "Тайлбар", en: "Description" }, kind: "textarea", bilingual: true, section: SECTION_CONTENT },
    ],
  },

  pages: {
    key: "pages",
    table: "pages",
    idColumn: "key",
    fixed: true,
    singular: { mn: "Хуудас", en: "Page" },
    plural: { mn: "Хуудсууд", en: "Pages" },
    listPrimary: "title",
    listStatus: false,
    defaultOrder: "key",
    fields: [
      { name: "title", label: { mn: "Гарчиг", en: "Title" }, kind: "text", bilingual: true, required: true, section: SECTION_CONTENT },
      { name: "body", label: { mn: "Агуулга", en: "Body" }, kind: "textarea", bilingual: true, section: SECTION_CONTENT },
    ],
  },
};

export function getResource(key: string): ResourceDef | undefined {
  return RESOURCES[key];
}

export function bi(value: Bi, locale: Locale): string {
  return locale === "mn" ? value.mn : value.en;
}

/** Every column a field definition writes to. Used to build the SQL column list. */
export function columnsFor(field: FieldDef): string[] {
  return field.bilingual ? [`${field.name}_mn`, `${field.name}_en`] : [field.name];
}

export function allColumns(resource: ResourceDef): string[] {
  return resource.fields.flatMap(columnsFor);
}
