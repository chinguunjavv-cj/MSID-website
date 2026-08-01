import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Where admin uploads go.
 *
 * Two backends, chosen by environment rather than by a build flag, so the same code
 * runs on Vercel and on a container with a volume:
 *
 *   BLOB_READ_WRITE_TOKEN set → Vercel Blob. Required on Vercel, which has no writable
 *                               disk at all; files come back as absolute CDN URLs.
 *   otherwise                 → the local filesystem, served by /uploads/[...path].
 *
 * Because Blob returns an absolute URL and the filesystem returns `/uploads/…`, the
 * stored value is used as-is everywhere and both work without the rest of the app
 * knowing which backend is in play.
 */

/** Allowed uploads keyed by MIME type. The extension comes from this table, never from
 *  the submitted filename, so a file cannot be stored under a surprising extension. */
export const ALLOWED_UPLOADS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
};

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export function usingBlobStorage(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function uploadDirectory(): string {
  return (
    process.env.MSID_UPLOAD_DIR ??
    join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads")
  );
}

export interface StoredFile {
  /** What gets written to the database and rendered in `src`/`href`. */
  path: string;
  size: number;
  name: string;
}

export async function storeUpload(file: File): Promise<StoredFile> {
  const extension = ALLOWED_UPLOADS[file.type];
  if (!extension) throw new Error(`Unsupported file type: ${file.type || extname(file.name)}`);

  const filename = `${randomUUID()}${extension}`;

  /*
    On Vercel the filesystem is read-only, so falling back to it would fail with an
    opaque EROFS error deep inside `mkdir`. Say what is actually wrong instead.
  */
  if (process.env.VERCEL && !usingBlobStorage()) {
    throw new Error(
      "BLOB_READ_WRITE_TOKEN is not set. Vercel has no writable filesystem, so uploads " +
        "need a Vercel Blob store with **public** access — connect one to this project " +
        "and make sure its read-write token is included in the environment.",
    );
  }

  if (usingBlobStorage()) {
    // Imported lazily so a filesystem deployment never loads the Blob SDK.
    const { put } = await import("@vercel/blob");
    try {
      /*
        `public` is required, not a preference. Board photographs, event covers and
        guideline PDFs are rendered by plain <img> and <a download> on a public site;
        a private store would reject this call, and its blobs can only be delivered by
        streaming them through a Function. A store's access mode cannot be changed
        after creation, so a private store has to be replaced with a public one.
      */
      const blob = await put(`uploads/${filename}`, file, {
        access: "public",
        contentType: file.type,
        // Filenames are already random UUIDs; a second random suffix would only make
        // the stored URL harder to read.
        addRandomSuffix: false,
      });
      return { path: blob.url, size: file.size, name: file.name };
    } catch (error) {
      const message = (error as Error).message ?? "";
      if (/access|private/i.test(message)) {
        throw new Error(
          "The connected Vercel Blob store is private. This site needs a store created " +
            "with public access — a store's access mode cannot be changed after " +
            "creation, so create a new public store and connect it to this project.",
        );
      }
      throw error;
    }
  }

  const directory = uploadDirectory();
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), Buffer.from(await file.arrayBuffer()));

  return { path: `/uploads/${filename}`, size: file.size, name: file.name };
}
