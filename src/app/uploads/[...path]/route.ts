import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { ALLOWED_UPLOADS, uploadDirectory } from "@/lib/storage";
import { Readable } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves admin-uploaded files.
 *
 * Only used by the filesystem storage backend. In development uploads land in
 * `public/uploads` and Next serves them statically, so this route rarely runs; on a
 * container with a volume they live outside the project (`MSID_UPLOAD_DIR`), which Next
 * cannot serve on its own — that deployment would otherwise 404 on every uploaded PDF.
 *
 * On Vercel this route is dead code: Vercel Blob stores absolute CDN URLs, so nothing
 * ever points at /uploads.
 */

/**
 * Content types this route will serve, derived from the same allow-list the upload
 * endpoint enforces, so the two can never drift apart. `.jpeg` is added because the
 * extension table stores `.jpg` but older files may carry either.
 */
const CONTENT_TYPES: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(ALLOWED_UPLOADS).map(([mime, ext]) => [ext, mime]),
  ),
  ".jpeg": "image/jpeg",
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
  const root = resolve(uploadDirectory());
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
