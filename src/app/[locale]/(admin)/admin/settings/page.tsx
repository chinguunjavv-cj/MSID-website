import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { isLocale } from "@/lib/i18n/config";
import { getSettings } from "@/lib/settings";
import { qpayConfigured } from "@/lib/payments/qpay";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { formLabels } from "@/components/admin/labels";
import { Notice } from "@/components/ui/Primitives";

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireStaffPage(locale);

  const mn = locale === "mn";
  const settings = await getSettings();

  return (
    <div>
      <h1 className="text-h2 font-bold">{mn ? "Сайтын тохиргоо" : "Site settings"}</h1>
      <p className="mt-3 max-w-[68ch] text-ink-600">
        {mn
          ? "Эдгээр утга нь сайтын хөл, холбоо барих хуудас, бүртгэлийн төлбөрийн зааварт шууд тусна."
          : "These values appear directly in the site footer, the contact page, and the payment instructions shown to people who register."}
      </p>

      {!qpayConfigured() && (
        <div className="mt-6 max-w-4xl">
          <Notice tone="info">
            {mn
              ? "QPay-г ашиглахын тулд эхлээд QPay-тэй мерчант гэрээ байгуулж, QPAY_USERNAME, QPAY_PASSWORD, QPAY_INVOICE_CODE, QPAY_CALLBACK_SECRET утгуудыг .env.local файлд бичих шаардлагатай. Тэр хүртэл бүртгэл дансаар шилжүүлэх горимоор ажиллана."
              : "To use QPay, MSID first needs a merchant agreement with QPay; then set QPAY_USERNAME, QPAY_PASSWORD, QPAY_INVOICE_CODE and QPAY_CALLBACK_SECRET in .env.local. Until then registration uses bank transfer."}
          </Notice>
        </div>
      )}

      <div className="mt-8">
        <SettingsForm
          locale={locale}
          settings={settings}
          labels={{
            ...formLabels(locale),
            saved: mn ? "Тохиргоо хадгалагдлаа." : "Settings saved.",
          }}
          sections={[
            {
              title: mn ? "Холбоо барих" : "Contact",
              fields: [
                { name: "contact_phone", label: mn ? "Утас" : "Telephone" },
                { name: "contact_email", label: mn ? "И-мэйл" : "Email" },
                {
                  name: "contact_address_mn",
                  label: mn ? "Хаяг (Монгол)" : "Address (Mongolian)",
                  kind: "textarea",
                  lang: "mn",
                },
                {
                  name: "contact_address_en",
                  label: mn ? "Хаяг (Англи)" : "Address (English)",
                  kind: "textarea",
                  lang: "en",
                },
                { name: "contact_hours_mn", label: mn ? "Ажиллах цаг (Монгол)" : "Hours (Mongolian)", lang: "mn" },
                { name: "contact_hours_en", label: mn ? "Ажиллах цаг (Англи)" : "Hours (English)", lang: "en" },
                {
                  name: "contact_map_url",
                  label: mn ? "Газрын зургийн embed холбоос" : "Map embed URL",
                  hint: mn
                    ? "Google Maps → Share → Embed a map хэсгээс src утгыг хуулна."
                    : "From Google Maps → Share → Embed a map, copy the src value only.",
                },
                { name: "facebook_url", label: "Facebook" },
                { name: "founded_on", label: mn ? "Байгуулагдсан огноо" : "Founded on", kind: "date" },
              ],
            },
            {
              title: mn ? "Нүүр хуудас" : "Home page",
              hint: mn
                ? "Хоосон орхивол нийгэмлэгийн нэр болон уриа автоматаар харагдана."
                : "Leave empty to fall back to the Society's name and tagline.",
              fields: [
                { name: "hero_headline_mn", label: mn ? "Гарчиг (Монгол)" : "Headline (Mongolian)", lang: "mn" },
                { name: "hero_headline_en", label: mn ? "Гарчиг (Англи)" : "Headline (English)", lang: "en" },
                { name: "hero_lead_mn", label: mn ? "Тайлбар (Монгол)" : "Lead (Mongolian)", kind: "textarea", lang: "mn" },
                { name: "hero_lead_en", label: mn ? "Тайлбар (Англи)" : "Lead (English)", kind: "textarea", lang: "en" },
                {
                  name: "hero_background",
                  label: mn ? "Нүүрний дэвсгэр зураг" : "Hero background image",
                  hint: mn
                    ? "Гарчгийн ард гарах зураг. Одоогийн утга /brand/steppe-altai.jpg — Алтайн хээрийн зураг. Зураг тавихад нүүрний хэсэг бараан өнгөтэй болж, бичвэр цагаанаар гарна; сүүдэр автоматаар нэмэгдэнэ. Өөр зургаар солих (жишээ нь /uploads/xxx.jpg) эсвэл хоосон болгож зураггүй цайвар дэвсгэр рүү буцаж болно."
                    : "Sits behind the headline. Currently /brand/steppe-altai.jpg, the Altai steppe photograph. With an image set the hero turns dark and the text runs in white, with a shadow laid automatically so it stays legible. Replace it (e.g. /uploads/xxx.jpg) or clear it to return to the plain light ground.",
                },
                {
                  name: "section_banner",
                  label: mn ? "Дотоод хуудасны дэвсгэр" : "Section banner image",
                  hint: mn
                    ? "Дотоод хуудсуудын гарчгийн ард гарах зураг (одоогоор /brand/steppe-altai.jpg). Бүх хэсэгт нэг зураг харагдана. Хоосон болговол гарчиг цагаан дэвсгэр дээр гарна."
                    : "Sits behind the title on interior pages (currently /brand/steppe-altai.jpg). One image across every section. Clear it and the titles return to type on paper.",
                },
                {
                  name: "hero_image",
                  label: mn ? "Нүүр зургийн зам" : "Hero image path",
                  hint: mn
                    ? "Зургаа аль нэг арга хэмжээнд хуулаад замыг нь энд буулгана (жишээ нь /uploads/xxx.jpg). Хоосон бол нийгэмлэгийн лого харагдана."
                    : "Upload an image on any event, then paste its path here (e.g. /uploads/xxx.jpg). Empty shows the Society's mark instead.",
                },
                { name: "hero_image_alt_mn", label: mn ? "Зургийн тайлбар (Монгол)" : "Image alt (Mongolian)", lang: "mn" },
                { name: "hero_image_alt_en", label: mn ? "Зургийн тайлбар (Англи)" : "Image alt (English)", lang: "en" },
              ],
            },
            {
              title: mn ? "Төлбөр" : "Payments",
              hint: mn
                ? "Дансны мэдээллийг оруулаагүй бол бүртгүүлсэн хүнд төлбөрийн заавар харагдахгүй."
                : "Without bank details, people who register are not shown payment instructions.",
              fields: [
                { name: "bank_name_mn", label: mn ? "Банк (Монгол)" : "Bank (Mongolian)", lang: "mn" },
                { name: "bank_name_en", label: mn ? "Банк (Англи)" : "Bank (English)", lang: "en" },
                { name: "bank_account_number", label: mn ? "Дансны дугаар" : "Account number" },
                { name: "bank_account_name", label: mn ? "Хүлээн авагчийн нэр" : "Account name" },
                {
                  name: "qpay_enabled",
                  label: mn ? "QPay-г идэвхжүүлэх" : "Enable QPay",
                  kind: "checkbox",
                  hint: mn
                    ? "QPAY_* орчны хувьсагчид тохируулагдсан үед л ажиллана."
                    : "Only takes effect once the QPAY_* environment variables are set.",
                },
              ],
            },
          ]}
        />
      </div>
    </div>
  );
}
