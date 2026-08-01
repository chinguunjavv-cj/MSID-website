import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves admin-uploaded files.
 *
 * In development uploads land in `public/uploads` and Next serves them statically, so
 * this route never runs. In production they live on a persistent volume outside the
 * project (`MSID_UPLOAD_DIR`), which Next cannot serve on its own — a deployment with a
 * volume would otherwise show every uploaded PDF and photograph as a 404.
 */

const UPLOAD_DIR =
  process.env.MSID_UPLOAD_DIR ??
  join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads");

/** Only the types the upload endpoint accepts; anything else is not served. */
const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;

  /*
    Path traversal guard. The joined path is resolved and then checked to be inside the
    upload directory, so `..` segments (however they are encoded) cannot escape it.
  */
  const root = resolve(UPLOAD_DIR);
  const target = resolve(join(root, ...path));
  if (target !== root && !target.startsWith(root + sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const type = CONTENT_TYPES[extname(target).toLowerCase()];
  if (!type) return new NextResponse("Not found", { status: 404 });

  let size: number;
  try {
    const info = await stat(target);
    if (!info.isFile()) return new NextResponse("Not found", { status: 404 });
    size = info.size;
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }

  const stream = Readable.toWeb(
    createReadStream(target),
  ) as unknown as ReadableStream<Uint8Array>;

  return new NextResponse(stream, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(size),
      // Filenames are random UUIDs and content never changes under a given name.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
