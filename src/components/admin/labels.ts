import type { Locale } from "@/lib/db/types";

/** Shared admin form chrome, in both languages. */
export function formLabels(locale: Locale): Record<string, string> {
  const mn = locale === "mn";
  return {
    errorTitle: mn ? "Маягтад алдаа байна." : "The form has errors.",
    save: mn ? "Хадгалах" : "Save",
    saving: mn ? "Хадгалж байна…" : "Saving…",
    delete: mn ? "Устгах" : "Delete",
    // "Бичлэг" now means video everywhere else on the site, so records are "контент".
    deleteHint: mn
      ? "Устгасан контентийг сэргээх боломжгүй."
      : "Deleting a record cannot be undone.",
    confirmDelete: mn
      ? "Энэ контентийг устгах уу? Буцаах боломжгүй."
      : "Delete this record? This cannot be undone.",
    uploading: mn ? "Хуулж байна…" : "Uploading…",
    /*
      iPhones photograph in HEIC by default and the server does not accept it, so the
      supported formats are stated up front rather than after a failed upload.
    */
    fileHint: mn
      ? "JPG, PNG, WebP, AVIF, SVG, PDF. Дээд тал нь 20 MB. iPhone-ы HEIC зургийг эхлээд JPG болгож хөрвүүлнэ үү."
      : "JPG, PNG, WebP, AVIF, SVG, PDF. Up to 20 MB. Convert iPhone HEIC photos to JPG first.",
    remove: mn ? "Хасах" : "Remove",
    add: mn ? "Нэмэх" : "Add",
    cancel: mn ? "Цуцлах" : "Cancel",
  };
}
