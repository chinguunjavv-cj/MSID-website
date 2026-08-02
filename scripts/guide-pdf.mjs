/**
 * Renders docs/admin-guide.html to ГАРЫН-АВЛАГА.pdf.
 *
 *   npm run guide:pdf
 *
 * The guide is authored once, as HTML, and printed from there — so the PDF an
 * administrator keeps on their desk and the page they read on a phone can never say
 * different things. Layout for paper lives in the `@media print` block of that same
 * file.
 *
 * Printing is done by headless Chrome rather than a PDF library because the guide is
 * in Mongolian: a library would need a Cyrillic font embedded and configured by hand,
 * including ө and ү, while a browser already renders the page correctly.
 *
 * `docs/admin-guide.html` is a fragment — no <html> or <head> — because it doubles as
 * the source of the published web version, which is wrapped by its host. This wraps it
 * for standalone rendering.
 */

import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFile } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { glob } from "node:fs/promises";

const run = promisify(execFile);

const SOURCE = resolve("docs/admin-guide.html");
const OUTPUT = resolve("ГАРЫН-АВЛАГА.pdf");

/**
 * Where a usable Chrome might be. Ordinary installs first, then the copies that
 * Playwright and Puppeteer download — on a machine that has run either, one is already
 * there and nothing needs installing.
 */
async function findChrome() {
  const fixed = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const path of fixed) if (existsSync(path)) return path;

  const patterns = [
    join(homedir(), "Library/Caches/ms-playwright/chromium-*/chrome-mac*/*.app/Contents/MacOS/*"),
    join(homedir(), ".cache/ms-playwright/chromium-*/chrome-linux/chrome"),
    join(homedir(), ".cache/puppeteer/chrome/*/chrome-*/*.app/Contents/MacOS/*"),
    join(homedir(), ".cache/puppeteer/chrome/*/chrome-linux64/chrome"),
  ];
  for (const pattern of patterns) {
    for await (const match of glob(pattern)) {
      // The .app bundle also contains helpers; the browser is the one without a suffix.
      if (!/Helper|crashpad|\.dylib$/.test(match)) return match;
    }
  }
  return null;
}

const chrome = process.env.CHROME_PATH ?? (await findChrome());

if (!chrome) {
  console.error(
    "No Chrome or Chromium found.\n\n" +
      "Install Google Chrome, or point this at an existing one:\n" +
      "  CHROME_PATH='/path/to/chrome' npm run guide:pdf",
  );
  process.exit(1);
}

const fragment = await readFile(SOURCE, "utf8");

/*
  `print-color-adjust` is what makes Chrome print the copper rules and callout grounds
  instead of dropping them as "background decoration". Without it the guide comes out as
  black text on white with none of its structure.
*/
const document = `<!doctype html>
<html lang="mn" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
</style>
${fragment}
</html>`;

const workDir = await mkdtemp(join(tmpdir(), "msid-guide-"));
const htmlPath = join(workDir, "guide.html");
await writeFile(htmlPath, document, "utf8");

try {
  await run(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-pdf-header-footer",
    `--print-to-pdf=${OUTPUT}`,
    `file://${htmlPath}`,
  ]);
  console.log(`Wrote ${OUTPUT}`);
} finally {
  await rm(workDir, { recursive: true, force: true });
}
