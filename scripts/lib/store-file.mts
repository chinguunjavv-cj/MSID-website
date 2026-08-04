import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import sharp from "sharp";

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
 *
 * Images are resized here rather than by hand beforehand. A portrait off a phone is
 * 2.4 MB and 4243px wide; the board grid renders it in a 480×600 box. Doing it in the
 * script means the import takes the original file MSID sent, which is the only version
 * that will still exist when this is run again against production.
 */

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
};

/** Target shapes, matching the boxes the pages actually render them in, at 2×. */
const SHAPES = {
  /** Board portraits — the grid is aspect-4/5 at 480×600. */
  portrait: { width: 960, height: 1200 },
  /** Event and hero covers — aspect-video at 1600×900. */
  cover: { width: 1600, height: 900 },
} as const;

export type Shape = keyof typeof SHAPES;

export async function storeFile(
  sourcePath: string,
  mime: string,
  shape?: Shape,
): Promise<string> {
  const extension = EXTENSIONS[mime];
  if (!extension) throw new Error(`Unsupported type ${mime} for ${sourcePath}`);

  const original = await readFile(sourcePath);

  /*
    Only raster images are reshaped. A PDF is stored byte for byte — it is the document
    itself, and re-encoding a Ministry of Health guideline is not this script's business.
  */
  const reshape = shape && mime.startsWith("image/") && mime !== "image/svg+xml";
  const bytes = reshape
    ? await sharp(original)
        .resize({ ...SHAPES[shape], fit: "cover", position: "attention" })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer()
    : original;

  // A reshaped image is always JPEG, whatever went in.
  const finalExtension = reshape ? ".jpg" : extension;
  const finalMime = reshape ? "image/jpeg" : mime;
  const filename = `${randomUUID()}${finalExtension}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`uploads/${filename}`, bytes, {
      access: "public",
      contentType: finalMime,
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
