import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { get, newId, run } from "@/lib/db";
import { checkQpayPayment, qpayConfig } from "@/lib/payments/qpay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * QPay payment callback.
 *
 * The callback is treated as a *hint* only: it says "something happened for this
 * reference". The registration is marked paid solely on the strength of a fresh
 * `payment/check` call back to QPay, and only when the confirmed amount covers what is
 * owed. A forged callback therefore cannot mark anything as paid.
 */
export async function GET(request: NextRequest) {
  const config = qpayConfig();
  if (!config) {
    return NextResponse.json({ error: "QPay is not configured" }, { status: 503 });
  }

  const reference = request.nextUrl.searchParams.get("reference") ?? "";
  const secret = request.nextUrl.searchParams.get("secret") ?? "";

  if (!reference || !secretMatches(secret, config.callbackSecret)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  const registration = await get<{
    id: string;
    amount_mnt: number;
    payment_ref: string;
    payment_status: string;
  }>(
    "SELECT id, amount_mnt, payment_ref, payment_status FROM registrations WHERE reference = ?",
    reference,
  );

  if (!registration) {
    return NextResponse.json({ error: "Unknown reference" }, { status: 404 });
  }
  if (registration.payment_status === "paid") {
    return NextResponse.json({ ok: true, already: true });
  }
  if (!registration.payment_ref) {
    return NextResponse.json({ error: "No invoice on record" }, { status: 409 });
  }

  let result: Awaited<ReturnType<typeof checkQpayPayment>>;
  try {
    result = await checkQpayPayment(registration.payment_ref);
  } catch (error) {
    console.error("QPay check failed", error);
    return NextResponse.json({ error: "Verification failed" }, { status: 502 });
  }

  if (!result.paid || result.amount < registration.amount_mnt) {
    await run(
      `UPDATE payments SET status = 'pending', raw_payload = ?, updated_at = datetime('now')
       WHERE registration_id = ? AND provider_invoice_id = ?`,
      JSON.stringify(result.raw),
      registration.id,
      registration.payment_ref,
    );
    return NextResponse.json({ ok: false, paid: false });
  }

  await run(
    `UPDATE registrations
     SET payment_status = 'paid', paid_at = datetime('now'),
         attendance_status = 'confirmed', updated_at = datetime('now')
     WHERE id = ?`,
    registration.id,
  );

  await run(
    `UPDATE payments SET status = 'paid', raw_payload = ?, updated_at = datetime('now')
     WHERE registration_id = ? AND provider_invoice_id = ?`,
    JSON.stringify(result.raw),
    registration.id,
    registration.payment_ref,
  );

  await run(
    `INSERT INTO audit_log (id, action, entity, entity_id, meta)
     VALUES (?, 'payment.confirmed', 'registration', ?, ?)`,
    newId(),
    registration.id,
    JSON.stringify({ provider: "qpay", amount: result.amount }),
  );

  return NextResponse.json({ ok: true, paid: true });
}

export const POST = GET;
