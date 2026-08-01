import { NextResponse, type NextRequest } from "next/server";
import { extname } from "node:path";
import { currentUser, isStaff } from "@/lib/auth/session";
import { newId, run } from "@/lib/db";
import {
  ALLOWED_UPLOADS,
  MAX_UPLOAD_BYTES,
  storeUpload,
} from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Admin file upload.
 *
 * The storage backend is decided in `@/lib/storage` — Vercel Blob when a token is
 * present, the local filesystem otherwise — so this route only handles authorisation,
 * validation and recording the result.
 */
export async function POST(request: NextRequest) {
  const user = await currentUser();
  if (!isStaff(user)) {
    return NextResponse.json({ error: "Not authorised" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file supplied" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `File is larger than ${MAX_UPLOAD_BYTES / 1_048_576} MB` },
      { status: 413 },
    );
  }
  if (!ALLOWED_UPLOADS[file.type]) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type || extname(file.name)}` },
      { status: 415 },
    );
  }

  let stored;
  try {
    stored = await storeUpload(file);
  } catch (error) {
    console.error("Upload failed", error);
    return NextResponse.json(
      { error: (error as Error).message || "Upload failed" },
      { status: 500 },
    );
  }

  await run(
    `INSERT INTO uploads (id, path, original_name, mime, size, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    newId(),
    stored.path,
    file.name.slice(0, 200),
    file.type,
    file.size,
    user!.id,
  );

  return NextResponse.json(stored);
}
