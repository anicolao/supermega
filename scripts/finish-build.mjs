import { legacyTableUrl } from "./legacy-table-url.mjs";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
await writeFile("dist/.nojekyll", "");
await writeFile("dist/404.html", `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Super Mega Lucky Box</title><p>Page not found. If this is an older table invitation, opening it now…</p><script type="module">${legacyTableUrl.toString()}; const target = legacyTableUrl(location.href); if (target) location.replace(target);</script></html>`);
for (const route of ["gallery", "gallery/tabletop", "tabletop"]) {
  await mkdir(`dist/${route}`, { recursive: true });
  await copyFile("dist/index.html", `dist/${route}/index.html`);
}
await writeFile(
  "dist/build.json",
  JSON.stringify({
    protocol: 2,
    sha: process.env.VITE_BUILD_SHA || process.env.GITHUB_SHA || "local",
    base: process.env.PUBLIC_BASE_PATH || "/",
    scope: process.env.VITE_PREVIEW_ID || "main",
  }),
);
