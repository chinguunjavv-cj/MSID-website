import { NextResponse, type NextRequest } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { currentUser, isStaff } from "@/lib/auth/session";
import { newId, run } from "@/lib/db";

export const runtime = "nodejs";

const MAX_BYTES = 20 * 1024 * 1024;

/**
 * Allowed uploads, keyed by MIME type. The extension is taken from this table rather
 * than from the submitted filename, so a file cannot be stored under an executable or
 * otherwise surprising extension regardless of what it is called.
 */
const ALLOWED: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/svg+xml": ".svg",
  "application/pdf": ".pdf",
};

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
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File is larger than ${MAX_BYTES / 1_048_576} MB` },
      { status: 413 },
    );
  }

  const extension = ALLOWED[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type || extname(file.name)}` },
      { status: 415 },
    );
  }

  /*
    `turbopackIgnore` stops the build tracer following this `process.cwd()` call and
    pulling the whole project into the output bundle. The path is resolved at runtime
    from a fixed literal (or `MSID_UPLOAD_DIR`), never from request data.
  */
  const directory =
    process.env.MSID_UPLOAD_DIR ??
    join(/* turbopackIgnore: true */ process.cwd(), "public", "uploads");
  await mkdir(directory, { recursive: true });

  const filename = `${randomUUID()}${extension}`;
  await writeFile(join(directory, filename), Buffer.from(await file.arrayBuffer()));

  const path = `/uploads/${filename}`;

  run(
    `INSERT INTO uploads (id, path, original_name, mime, size, uploaded_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    newId(),
    path,
    file.name.slice(0, 200),
    file.type,
    file.size,
    user!.id,
  );

  return NextResponse.json({ path, size: file.size, name: file.name });
}
