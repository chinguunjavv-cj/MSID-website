import "server-only";
import { get } from "@/lib/db";
import type { Locale } from "@/lib/db/types";

/**
 * Whether a record still has something attached that deleting it would destroy.
 *
 * Registrations are the case that matters: they are participants' names, contact
 * details and payment records, and an administrator tidying up after an old congress
 * should not be able to erase them along with the event. Archiving keeps everything and
 * takes the event off the site, which is what "delete" is usually meant to achieve.
 *
 * A plain server module, not a server action: it is used while rendering the edit page
 * and by the delete action, and nothing outside the server needs to call it.
 */
export async function deletionBlockedReason(
  resourceKey: string,
  id: string,
  locale: Locale,
): Promise<string | null> {
  if (resourceKey !== "events") return null;

  const taken = await get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM registrations WHERE event_id = ?",
    id,
  );
  const registrations = Number(taken?.n ?? 0);
  if (registrations === 0) return null;

  return locale === "mn"
    ? `Энэ арга хэмжээнд ${registrations} бүртгэл байгаа тул устгах боломжгүй. Оролцогчдын мэдээллийг хадгалахын тулд төлөвийг нь “Архивласан” болгоно уу.`
    : `This event has ${registrations} registration(s) and cannot be deleted. Set its status to “Archived” instead, which keeps the participants' records.`;
}
