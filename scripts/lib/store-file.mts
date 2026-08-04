import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

/**
 * Stores a file the same way the admin's upload endpoint does — Vercel Blob when a
 * token is present, the local filesystem otherwise — and returns the value to put in
 * the database.
 *
 * This deliberately does not import `@/lib/storage`. That module is marked
 * `server-only`, which throws outside a React server context, so a plain Node script
 * cannot use it. The rule it encodes is small enough to restate: extension comes from
 * the MIME type and never from the submitted filename, and the stored name is a random
 * UUID.
 */

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
};

export async function storeFile(sourcePath: string, mime: string): Promise<string> {
  const extension = EXTENSIONS[mime];
  if (!extension) throw new Error(`Unsupported type ${mime} for ${sourcePath}`);

  const bytes = await readFile(sourcePath);
  const filename = `${randomUUID()}${extension}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${filename}`, bytes, {
      access: "public",
      contentType: mime,
      addRandomSuffix: false,
    });
    return blob.url;
  }

  const directory = process.env.MSID_UPLOAD_DIR ?? join("public", "uploads");
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), bytes);
  return `/uploads/${filename}`;
}

export function mimeFor(path: string): string {
  const byExtension: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
  };
  const mime = byExtension[extname(path).toLowerCase()];
  if (!mime) throw new Error(`Cannot infer a type for ${path}`);
  return mime;
}
