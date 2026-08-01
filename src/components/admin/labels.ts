import type { Locale } from "@/lib/db/types";

/** Shared admin form chrome, in both languages. */
export function formLabels(locale: Locale): Record<string, string> {
  const mn = locale === "mn";
  return {
    errorTitle: mn ? "Маягтад алдаа байна." : "The form has errors.",
    save: mn ? "Хадгалах" : "Save",
    saving: mn ? "Хадгалж байна…" : "Saving…",
    delete: mn ? "Устгах" : "Delete",
    deleteHint: mn
      ? "Устгасан бичлэгийг сэргээх боломжгүй."
      : "Deleting a record cannot be undone.",
    confirmDelete: mn
      ? "Энэ бичлэгийг устгах уу? Буцаах боломжгүй."
      : "Delete this record? This cannot be undone.",
    uploading: mn ? "Хуулж байна…" : "Uploading…",
    remove: mn ? "Хасах" : "Remove",
    add: mn ? "Нэмэх" : "Add",
    cancel: mn ? "Цуцлах" : "Cancel",
  };
}
