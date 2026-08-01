import { NextResponse, type NextRequest } from "next/server";
import { currentUser, isStaff } from "@/lib/auth/session";
import { listRegistrations } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Escapes a CSV cell. The leading apostrophe on `=+-@` guards against formula
 * injection: a participant could otherwise type `=HYPERLINK(...)` into their name and
 * have it execute when an administrator opens the export in Excel.
 */
function cell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const user = await currentUser();
  if (!isStaff(user)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const registrations = listRegistrations({
    eventId: searchParams.get("event") ?? undefined,
    paymentStatus: searchParams.get("payment") ?? undefined,
    query: searchParams.get("q") ?? undefined,
  });

  const headers = [
    "reference",
    "event",
    "full_name",
    "email",
    "phone",
    "institution",
    "position",
    "country",
    "is_member",
    "amount_mnt",
    "payment_method",
    "payment_status",
    "paid_at",
    "attendance_status",
    "abstract_title",
    "notes",
    "registered_at",
  ];

  const lines = [
    headers.join(","),
    ...registrations.map((registration) =>
      [
        registration.reference,
        registration.event_title_mn || registration.event_title_en,
        registration.full_name,
        registration.email,
        registration.phone,
        registration.institution,
        registration.position,
        registration.country,
        registration.is_member ? "yes" : "no",
        registration.amount_mnt,
        registration.payment_method,
        registration.payment_status,
        registration.paid_at ?? "",
        registration.attendance_status,
        registration.abstract_title,
        registration.notes,
        registration.created_at,
      ]
        .map(cell)
        .join(","),
    ),
  ];

  // The BOM makes Excel open the file as UTF-8, without which Mongolian Cyrillic
  // arrives as mojibake on Windows.
  const body = `﻿${lines.join("\r\n")}\r\n`;
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="msid-registrations-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
