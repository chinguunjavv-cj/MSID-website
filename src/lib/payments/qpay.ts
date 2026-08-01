import "server-only";

/**
 * QPay v2 client.
 *
 * QPay is Mongolia's dominant QR/card gateway. Using it requires a merchant agreement
 * with QPay; MSID does not have credentials yet, so `qpayConfigured()` returns false
 * and registration falls back to bank transfer. Nothing else in the app needs to change
 * when the credentials arrive — set the five `QPAY_*` variables in `.env.local` and
 * flip `qpay_enabled` in admin settings.
 *
 * API reference: https://developer.qpay.mn (v2).
 */

interface QpayConfig {
  baseUrl: string;
  username: string;
  password: string;
  invoiceCode: string;
  callbackSecret: string;
}

export interface QpayInvoice {
  invoiceId: string;
  qrText: string;
  qrImage: string;
  /** Deep links into individual Mongolian banking apps. */
  urls: { name: string; description: string; link: string }[];
}

export function qpayConfig(): QpayConfig | null {
  const {
    QPAY_BASE_URL,
    QPAY_USERNAME,
    QPAY_PASSWORD,
    QPAY_INVOICE_CODE,
    QPAY_CALLBACK_SECRET,
  } = process.env;

  if (!QPAY_USERNAME || !QPAY_PASSWORD || !QPAY_INVOICE_CODE || !QPAY_CALLBACK_SECRET) {
    return null;
  }

  return {
    baseUrl: (QPAY_BASE_URL || "https://merchant.qpay.mn/v2").replace(/\/$/, ""),
    username: QPAY_USERNAME,
    password: QPAY_PASSWORD,
    invoiceCode: QPAY_INVOICE_CODE,
    callbackSecret: QPAY_CALLBACK_SECRET,
  };
}

export function qpayConfigured(): boolean {
  return qpayConfig() !== null;
}

/**
 * Access tokens are valid for hours; cached in module scope so a burst of
 * registrations does not re-authenticate on every request.
 */
let tokenCache: { token: string; expiresAt: number } | null = null;

async function accessToken(config: QpayConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;

  const credentials = Buffer.from(`${config.username}:${config.password}`).toString(
    "base64",
  );
  const response = await fetch(`${config.baseUrl}/auth/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`QPay auth failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in?: number;
  };

  tokenCache = {
    token: data.access_token,
    // QPay returns an absolute epoch in some responses and a duration in others.
    expiresAt: Date.now() + (data.expires_in && data.expires_in < 1e6
      ? data.expires_in * 1000
      : 3_600_000),
  };

  return tokenCache.token;
}

export async function createQpayInvoice(input: {
  reference: string;
  amountMnt: number;
  description: string;
  payerEmail?: string;
}): Promise<QpayInvoice> {
  const config = qpayConfig();
  if (!config) throw new Error("QPay is not configured.");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callbackUrl = `${siteUrl}/api/payments/qpay/callback?reference=${encodeURIComponent(
    input.reference,
  )}&secret=${encodeURIComponent(config.callbackSecret)}`;

  const response = await fetch(`${config.baseUrl}/invoice`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken(config)}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      invoice_code: config.invoiceCode,
      sender_invoice_no: input.reference,
      invoice_receiver_code: input.payerEmail ?? "terminal",
      invoice_description: input.description.slice(0, 100),
      amount: input.amountMnt,
      callback_url: callbackUrl,
    }),
  });

  if (!response.ok) {
    throw new Error(`QPay invoice failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    invoice_id: string;
    qr_text: string;
    qr_image: string;
    urls?: { name: string; description: string; link: string }[];
  };

  return {
    invoiceId: data.invoice_id,
    qrText: data.qr_text,
    qrImage: data.qr_image,
    urls: data.urls ?? [],
  };
}

/**
 * Confirms with QPay that an invoice is actually paid.
 *
 * Always called before a registration is marked paid — the callback itself is only a
 * hint that something happened, and must never be trusted as proof of payment.
 */
export async function checkQpayPayment(
  invoiceId: string,
): Promise<{ paid: boolean; amount: number; raw: unknown }> {
  const config = qpayConfig();
  if (!config) throw new Error("QPay is not configured.");

  const response = await fetch(`${config.baseUrl}/payment/check`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken(config)}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      object_type: "INVOICE",
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    }),
  });

  if (!response.ok) {
    throw new Error(`QPay check failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as {
    count?: number;
    paid_amount?: number;
    rows?: { payment_status?: string; payment_amount?: string }[];
  };

  const paidRow = data.rows?.find((row) => row.payment_status === "PAID");

  return {
    paid: Boolean(paidRow) || Number(data.paid_amount ?? 0) > 0,
    amount: Number(paidRow?.payment_amount ?? data.paid_amount ?? 0),
    raw: data,
  };
}
